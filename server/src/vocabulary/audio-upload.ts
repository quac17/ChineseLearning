import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { Request, Response } from 'express';
import { StorageService } from '../common/storage/storage.service';

export const AUDIO_CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.aac': 'audio/aac',
};

const ACCEPTABLE_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/x-aac',
  'application/octet-stream',
]);

export const AUDIO_FORMATS_MESSAGE =
  'Chỉ hỗ trợ tệp âm thanh MP3, WAV, M4A, OGG, WEBM hoặc AAC.';

const DEFAULT_MAX_AUDIO_MB = 10;

export function maxAudioBytes(envValue: string | undefined = process.env.MAX_AUDIO_SIZE_MB): number {
  const mb = Number(envValue);
  const effective = Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_AUDIO_MB;
  return Math.round(effective * 1024 * 1024);
}

export function audioContentType(fileName: string): string | null {
  const ext = path.extname(fileName || '').toLowerCase();
  return AUDIO_CONTENT_TYPES[ext] ?? null;
}

export function isAcceptableAudioMime(mime: string | undefined): boolean {
  if (!mime) return false;
  const base = mime.split(';')[0].trim().toLowerCase();
  return ACCEPTABLE_AUDIO_MIMES.has(base);
}

/** Multer reports UTF-8 filenames in latin1; convert back safely. */
export function decodeUploadName(originalName: string): string {
  return Buffer.from(originalName, 'latin1').toString('utf8');
}

/** Cache-busting version query derived from the server-generated storage key. */
export function audioVersionParam(storageKey: string | null | undefined): string {
  if (!storageKey) return '';
  const base = path.basename(storageKey).split('.')[0];
  return `?v=${encodeURIComponent(base)}`;
}

/** Audio files are small (≤ 10 MB): keep in memory, validate, then persist via StorageService. */
export const audioUploadInterceptorOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: maxAudioBytes(),
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!audioContentType(file.originalname) || !isAcceptableAudioMime(file.mimetype)) {
      return cb(new BadRequestException(AUDIO_FORMATS_MESSAGE), false);
    }
    cb(null, true);
  },
};

/**
 * Streams an access-checked audio object.
 * - `gcs`: 302 redirect to a short-lived signed URL (no-store).
 * - `local`: streams with Range support so browsers can replay/seek reliably.
 */
export async function serveAudioFile(
  storage: StorageService,
  storageKey: string,
  mimeType: string | null | undefined,
  req: Request,
  res: Response,
): Promise<void> {
  const contentType = mimeType || audioContentType(storageKey) || 'audio/mpeg';

  if (storage.usesSignedUrls) {
    const { url } = await storage.getSignedReadUrl(storageKey, { contentType });
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
    return;
  }

  const fileSize = await storage.getFileSize(storageKey);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    storage.pipeTo(res, storageKey, { start, end });
    return;
  }

  res.writeHead(200, {
    'Content-Length': fileSize,
    'Accept-Ranges': 'bytes',
    'Content-Type': contentType,
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  storage.pipeTo(res, storageKey);
}
