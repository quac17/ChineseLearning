import * as crypto from 'crypto';
import * as path from 'path';

/**
 * Rules for uploading a lesson video straight to the bucket (STORAGE_BACKEND=gcs):
 * the API checks the teacher and the file, signs a PUT URL for a key it made,
 * and hands out a token that ties that key to this teacher and course. The
 * confirm call only accepts a key with a valid token, so nobody can attach
 * an object they did not upload through this flow.
 */

/** Allowed extensions and the Content-Type the bucket object gets. */
export const VIDEO_CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg',
  '.mkv': 'video/x-matroska',
};

export const VIDEO_FORMATS_MESSAGE = 'Chỉ hỗ trợ tệp video định dạng .mp4, .webm, .mov, .m4v, .ogg, .mkv';

/** A token is accepted for one day: long enough for a slow upload of a large video. */
export const UPLOAD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const VIDEO_KEY = /^videos\/\d+-[a-f0-9]{12}\.(mp4|m4v|webm|mov|ogg|mkv)$/;

export function maxVideoBytes(): number {
  return (Number(process.env.MAX_VIDEO_SIZE_MB) || 500) * 1024 * 1024;
}

/** Content-Type for an allowed video file name, or null when the extension is not allowed. */
export function videoContentType(fileName: string): string | null {
  return VIDEO_CONTENT_TYPES[path.extname(fileName).toLowerCase()] ?? null;
}

/** The browser's own type must look like a video (some report nothing or octet-stream). */
export function isAcceptableVideoMime(mime: string | undefined | null): boolean {
  if (!mime) return true;
  const m = mime.toLowerCase();
  return m.startsWith('video/') || m === 'application/octet-stream';
}

/** Only keys the server generates for videos (`videos/<time>-<12 hex>.<ext>`). */
export function isVideoStorageKey(key: string): boolean {
  return VIDEO_KEY.test(key);
}

interface TokenClaims {
  userId: string;
  courseId: string;
  storageKey: string;
}

function mac(claims: TokenClaims, issuedAt: number, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`video-upload|${claims.userId}|${claims.courseId}|${claims.storageKey}|${issuedAt}`)
    .digest('hex');
}

export function signUploadToken(claims: TokenClaims, secret: string, now = Date.now()): string {
  return `${now}.${mac(claims, now, secret)}`;
}

export function verifyUploadToken(token: string, claims: TokenClaims, secret: string, now = Date.now()): boolean {
  const [issued, signature] = String(token ?? '').split('.');
  const issuedAt = Number(issued);
  if (!Number.isInteger(issuedAt) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (issuedAt > now + 60_000 || now - issuedAt > UPLOAD_TOKEN_TTL_MS) return false;
  const expected = Buffer.from(mac(claims, issuedAt, secret), 'hex');
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
