import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StorageService } from './storage.service';

// The GCS client is replaced: no network, no credentials.
const mockFile = {
  getSignedUrl: jest.fn(async (_opts: Record<string, unknown>) => ['https://storage.googleapis.com/b/o?X-Goog-Signature=sig']),
  exists: jest.fn(async () => [true]),
  getMetadata: jest.fn(async () => [{ size: '2048', contentType: 'video/mp4' }]),
  save: jest.fn(async () => undefined),
  delete: jest.fn(async () => undefined),
};
const mockBucket = {
  file: jest.fn((_name: string) => mockFile),
  upload: jest.fn(async (_path: string, _opts: Record<string, unknown>) => undefined),
};
const mockBucketFn = jest.fn((_name: string) => mockBucket);
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn(() => ({ bucket: mockBucketFn })),
}));

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-storage-'));
const config = (env: Record<string, string | undefined>) =>
  ({ get: (key: string) => ({ UPLOAD_DIR: uploadDir, ...env })[key] }) as any;
const gcs = (env: Record<string, string> = {}) =>
  new StorageService(config({ STORAGE_BACKEND: 'gcs', GCS_BUCKET: 'vankinh-media', ...env }));

const NOW = Date.parse('2026-11-22T10:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => jest.restoreAllMocks());

describe('StorageService backend switch', () => {
  it('defaults to the local disk, which never signs URLs', async () => {
    const storage = new StorageService(config({}));
    expect(storage.backend).toBe('local');
    expect(storage.usesSignedUrls).toBe(false);
    await expect(storage.getSignedReadUrl('videos/1-aaaaaaaaaaaa.mp4')).rejects.toThrow();
    expect(mockBucketFn).not.toHaveBeenCalled();
  });

  it('refuses to start on gcs without a bucket, or with an unknown backend', () => {
    expect(() => new StorageService(config({ STORAGE_BACKEND: 'gcs' }))).toThrow(/GCS_BUCKET/);
    expect(() => new StorageService(config({ STORAGE_BACKEND: 's3' }))).toThrow(/STORAGE_BACKEND/);
  });

  it('opens the configured bucket on gcs', () => {
    const storage = gcs();
    expect(storage.usesSignedUrls).toBe(true);
    expect(mockBucketFn).toHaveBeenCalledWith('vankinh-media');
  });
});

describe('StorageService on gcs', () => {
  it('signs a V4 read URL for the same key layout, valid 15 minutes by default', async () => {
    const signed = await gcs().getSignedReadUrl('videos/1700000000000-0123456789ab.mp4', { contentType: 'video/mp4' });

    expect(mockBucket.file).toHaveBeenCalledWith('videos/1700000000000-0123456789ab.mp4');
    const opts = mockFile.getSignedUrl.mock.calls[0][0];
    expect(opts).toMatchObject({ version: 'v4', action: 'read', expires: NOW + 15 * 60_000, responseType: 'video/mp4' });
    expect(opts.responseDisposition).toBeUndefined();
    expect(signed).toEqual({
      url: 'https://storage.googleapis.com/b/o?X-Goog-Signature=sig',
      expiresAt: '2026-11-22T10:15:00.000Z',
    });
  });

  it('takes the read lifetime from GCS_SIGNED_URL_TTL_MIN', async () => {
    const signed = await gcs({ GCS_SIGNED_URL_TTL_MIN: '10' }).getSignedReadUrl('documents/1-0123456789ab.docx');
    expect(mockFile.getSignedUrl.mock.calls[0][0].expires).toBe(NOW + 10 * 60_000);
    expect(signed.expiresAt).toBe('2026-11-22T10:10:00.000Z');
  });

  it('makes documents download under their Vietnamese name', async () => {
    await gcs().getSignedReadUrl('documents/1-0123456789ab.docx', { downloadName: 'Bài 1 từ vựng.docx' });
    expect(mockFile.getSignedUrl.mock.calls[0][0].responseDisposition).toBe(
      `attachment; filename="B_i 1 t_ v_ng.docx"; filename*=UTF-8''B%C3%A0i%201%20t%E1%BB%AB%20v%E1%BB%B1ng.docx`,
    );
  });

  it('signs a V4 PUT URL bound to the content type, valid 30 minutes by default', async () => {
    const signed = await gcs().getSignedUploadUrl('videos/1-0123456789ab.webm', 'video/webm');
    expect(mockFile.getSignedUrl.mock.calls[0][0]).toEqual({
      version: 'v4',
      action: 'write',
      expires: NOW + 30 * 60_000,
      contentType: 'video/webm',
    });
    expect(signed.expiresAt).toBe('2026-11-22T10:30:00.000Z');
  });

  it('never maps a key outside the storage root', async () => {
    const storage = gcs();
    await expect(storage.getSignedReadUrl('../../etc/passwd')).resolves.toBeDefined();
    expect(mockBucket.file).toHaveBeenLastCalledWith('etc/passwd');
    expect(() => storage.resolveFullPath('/etc/passwd')).toThrow();
  });

  it('moves a multipart scratch file into the bucket and removes the local copy', async () => {
    const scratch = path.join(uploadDir, 'documents', 'scratch.docx');
    fs.writeFileSync(scratch, 'x');
    await gcs().persistUpload('documents/scratch.docx', scratch, 'application/msword');
    expect(mockBucket.upload).toHaveBeenCalledWith(scratch, expect.objectContaining({
      destination: 'documents/scratch.docx',
      contentType: 'application/msword',
    }));
    expect(fs.existsSync(scratch)).toBe(false);
  });

  it('reads size and type from the object metadata, null when missing', async () => {
    const storage = gcs();
    await expect(storage.getObjectInfo('videos/a.mp4')).resolves.toEqual({ size: 2048, contentType: 'video/mp4' });
    mockFile.exists.mockResolvedValueOnce([false]);
    await expect(storage.getObjectInfo('videos/a.mp4')).resolves.toBeNull();
  });
});
