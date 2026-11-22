import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bucket, Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Readable, Writable } from 'stream';

export type StorageBackend = 'local' | 'gcs';
export type StorageFolder = 'videos' | 'documents' | 'subtitles' | 'covers';

/** A short-lived link to one object; never stored in the DB, never logged. */
export interface SignedUrl {
  url: string;
  expiresAt: string;
}

export interface StoredObjectInfo {
  size: number;
  contentType: string | null;
}

const DEFAULT_READ_TTL_MIN = 15;
const DEFAULT_UPLOAD_TTL_MIN = 30;

function positiveNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Where uploaded videos, documents, subtitles and covers live.
 *
 * - `local` (default, dev and e2e): files under UPLOAD_DIR.
 * - `gcs`: a private Google Cloud Storage bucket (GCS_BUCKET). Credentials come
 *   from Application Default Credentials (the Cloud Run service account), so
 *   no key file is needed. Paid files are only reached through short-lived
 *   V4 signed URLs that callers issue after the access check.
 *
 * Storage keys are the same on both backends (`videos/<id>.mp4`), so the DB
 * does not change when files move to the bucket.
 */
@Injectable()
export class StorageService {
  readonly backend: StorageBackend;
  private readonly uploadDir: string;
  private readonly bucket: Bucket | null = null;
  private readonly readTtlMs: number;
  private readonly uploadTtlMs: number;

  constructor(private readonly configService: ConfigService) {
    const backend = (this.configService.get<string>('STORAGE_BACKEND') || 'local').trim().toLowerCase();
    if (backend !== 'local' && backend !== 'gcs') {
      throw new Error(`STORAGE_BACKEND must be "local" or "gcs", got "${backend}".`);
    }
    this.backend = backend;

    // Also used on `gcs` as the scratch folder for multipart uploads.
    this.uploadDir = path.resolve(
      this.configService.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads'),
    );
    fs.mkdirSync(path.join(this.uploadDir, 'videos'), { recursive: true });
    fs.mkdirSync(path.join(this.uploadDir, 'documents'), { recursive: true });

    this.readTtlMs = positiveNumber(this.configService.get('GCS_SIGNED_URL_TTL_MIN'), DEFAULT_READ_TTL_MIN) * 60_000;
    this.uploadTtlMs = positiveNumber(this.configService.get('GCS_UPLOAD_URL_TTL_MIN'), DEFAULT_UPLOAD_TTL_MIN) * 60_000;

    if (backend === 'gcs') {
      const bucketName = this.configService.get<string>('GCS_BUCKET')?.trim();
      if (!bucketName) {
        throw new Error('STORAGE_BACKEND=gcs needs GCS_BUCKET (the private bucket name).');
      }
      const projectId = this.configService.get<string>('GCS_PROJECT_ID')?.trim() || undefined;
      this.bucket = new Storage(projectId ? { projectId } : {}).bucket(bucketName);
    }
  }

  /** True when the browser uploads straight to the bucket and reads through signed URLs. */
  get usesSignedUrls(): boolean {
    return this.backend === 'gcs';
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  generateStorageKey(folder: StorageFolder, originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    return `${folder}/${uniqueId}${ext}`;
  }

  /** Local path of a key; blocks path traversal. Also the scratch path on `gcs`. */
  resolveFullPath(storageKey: string): string {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(this.uploadDir, normalized);
    if (!fullPath.startsWith(this.uploadDir + path.sep)) {
      throw new NotFoundException('Đường dẫn tệp không hợp lệ.');
    }
    return fullPath;
  }

  /** Object name in the bucket; same traversal rules as the local path. */
  private objectName(storageKey: string): string {
    const full = this.resolveFullPath(storageKey);
    return path.relative(this.uploadDir, full).split(path.sep).join('/');
  }

  private gcsFile(storageKey: string) {
    return this.bucket!.file(this.objectName(storageKey));
  }

  async saveBuffer(storageKey: string, buffer: Buffer, contentType?: string): Promise<void> {
    if (this.bucket) {
      await this.gcsFile(storageKey).save(buffer, { resumable: false, contentType });
      return;
    }
    const fullPath = this.resolveFullPath(storageKey);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
  }

  /**
   * Moves a file multer wrote to disk into storage under `storageKey`. On
   * `local` multer already wrote it at the key's path, so nothing moves; on
   * `gcs` it is uploaded and the scratch copy removed.
   */
  async persistUpload(storageKey: string, localPath: string, contentType?: string): Promise<void> {
    if (!this.bucket) {
      const target = this.resolveFullPath(storageKey);
      if (path.resolve(localPath) !== target) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        await fs.promises.rename(localPath, target);
      }
      return;
    }
    try {
      await this.bucket.upload(localPath, {
        destination: this.objectName(storageKey),
        resumable: true,
        contentType,
      });
    } finally {
      await fs.promises.unlink(localPath).catch(() => undefined);
    }
  }

  /** Size and type of a stored object, or null when it does not exist. */
  async getObjectInfo(storageKey: string): Promise<StoredObjectInfo | null> {
    if (this.bucket) {
      const file = this.gcsFile(storageKey);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [meta] = await file.getMetadata();
      return { size: Number(meta.size) || 0, contentType: meta.contentType ?? null };
    }
    const fullPath = this.resolveFullPath(storageKey);
    if (!fs.existsSync(fullPath)) return null;
    return { size: fs.statSync(fullPath).size, contentType: null };
  }

  async fileExists(storageKey: string): Promise<boolean> {
    return (await this.getObjectInfo(storageKey)) !== null;
  }

  async getFileSize(storageKey: string): Promise<number> {
    const info = await this.getObjectInfo(storageKey);
    if (!info) throw new NotFoundException('Không tìm thấy tệp trên kho lưu trữ.');
    return info.size;
  }

  /** Streams an object through the API (covers, subtitles, local videos). */
  createReadStream(storageKey: string, options?: { start?: number; end?: number }): Readable {
    if (this.bucket) {
      return this.gcsFile(storageKey).createReadStream(options);
    }
    const fullPath = this.resolveFullPath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Không tìm thấy tệp trên kho lưu trữ.');
    }
    return fs.createReadStream(fullPath, options);
  }

  /**
   * Pipes an object into an HTTP response. A read error after the headers
   * went out (e.g. the bucket drops the connection) ends the response instead
   * of crashing the process with an unhandled stream error.
   */
  pipeTo(res: Writable, storageKey: string, options?: { start?: number; end?: number }): void {
    const stream = this.createReadStream(storageKey, options);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  async deleteFile(storageKey: string | null | undefined): Promise<void> {
    if (!storageKey) return;
    try {
      if (this.bucket) {
        await this.gcsFile(storageKey).delete({ ignoreNotFound: true });
        return;
      }
      const fullPath = this.resolveFullPath(storageKey);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch {
      // Cleanup is best effort: a missing file must not fail the request.
    }
  }

  /**
   * V4 signed GET URL, valid GCS_SIGNED_URL_TTL_MIN minutes (default 15).
   * Call ONLY after the access check. `downloadName` makes the browser save
   * the file (documents) instead of showing it.
   */
  async getSignedReadUrl(
    storageKey: string,
    options: { contentType?: string; downloadName?: string } = {},
  ): Promise<SignedUrl> {
    if (!this.bucket) throw new Error('Signed URLs need STORAGE_BACKEND=gcs.');
    const expires = Date.now() + this.readTtlMs;
    const [url] = await this.gcsFile(storageKey).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires,
      responseType: options.contentType,
      responseDisposition: options.downloadName ? contentDisposition(options.downloadName) : undefined,
    });
    return { url, expiresAt: new Date(expires).toISOString() };
  }

  /**
   * V4 signed PUT URL for one object, valid GCS_UPLOAD_URL_TTL_MIN minutes
   * (default 30). The browser must send exactly `contentType`.
   */
  async getSignedUploadUrl(storageKey: string, contentType: string): Promise<SignedUrl> {
    if (!this.bucket) throw new Error('Signed URLs need STORAGE_BACKEND=gcs.');
    const expires = Date.now() + this.uploadTtlMs;
    const [url] = await this.gcsFile(storageKey).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires,
      contentType,
    });
    return { url, expiresAt: new Date(expires).toISOString() };
  }
}

/** `attachment` header that keeps Vietnamese file names (RFC 6266 / 5987). */
export function contentDisposition(fileName: string): string {
  const asciiFallback = String(fileName).replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
