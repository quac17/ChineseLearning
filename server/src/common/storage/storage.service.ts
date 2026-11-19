import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = path.resolve(
      this.configService.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads'),
    );
    fs.mkdirSync(path.join(this.uploadDir, 'videos'), { recursive: true });
    fs.mkdirSync(path.join(this.uploadDir, 'documents'), { recursive: true });
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  generateStorageKey(folder: 'videos' | 'documents', originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    return `${folder}/${uniqueId}${ext}`;
  }

  resolveFullPath(storageKey: string): string {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(this.uploadDir, normalized);
    if (!fullPath.startsWith(this.uploadDir)) {
      throw new NotFoundException('Đường dẫn tệp không hợp lệ.');
    }
    return fullPath;
  }

  async saveBuffer(storageKey: string, buffer: Buffer): Promise<void> {
    const fullPath = this.resolveFullPath(storageKey);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
  }

  fileExists(storageKey: string): boolean {
    const fullPath = this.resolveFullPath(storageKey);
    return fs.existsSync(fullPath);
  }

  getFileStat(storageKey: string): fs.Stats {
    const fullPath = this.resolveFullPath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Không tìm thấy tệp trên kho lưu trữ.');
    }
    return fs.statSync(fullPath);
  }

  createReadStream(storageKey: string, options?: { start?: number; end?: number }): fs.ReadStream {
    const fullPath = this.resolveFullPath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Không tìm thấy tệp trên kho lưu trữ.');
    }
    return fs.createReadStream(fullPath, options);
  }

  async deleteFile(storageKey: string | null | undefined): Promise<void> {
    if (!storageKey) return;
    try {
      const fullPath = this.resolveFullPath(storageKey);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch {
      // Ignore cleanup errors for missing files
    }
  }
}
