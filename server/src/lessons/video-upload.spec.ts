import { isVideoStorageKey, signUploadToken, verifyUploadToken, videoContentType } from './video-upload';

const claims = { userId: 'teacher', courseId: 'course_1', storageKey: 'videos/1700000000000-0123456789ab.mp4' };
const T0 = Date.parse('2026-11-22T10:00:00Z');

describe('upload token', () => {
  it('is accepted for the same teacher, course and key for 24 hours', () => {
    const token = signUploadToken(claims, 's', T0);
    expect(verifyUploadToken(token, claims, 's', T0 + 23 * 3600_000)).toBe(true);
    expect(verifyUploadToken(token, claims, 's', T0 + 25 * 3600_000)).toBe(false);
  });

  it.each([
    ['another teacher', { userId: 'teacher2' }],
    ['another course', { courseId: 'course_2' }],
    ['another key', { storageKey: 'videos/1700000000000-ffffffffffff.mp4' }],
  ])('is refused for %s', (_, patch) => {
    const token = signUploadToken(claims, 's', T0);
    expect(verifyUploadToken(token, { ...claims, ...patch }, 's', T0)).toBe(false);
  });

  it('is refused with another secret or garbage', () => {
    expect(verifyUploadToken(signUploadToken(claims, 's', T0), claims, 'other', T0)).toBe(false);
    expect(verifyUploadToken('nope', claims, 's', T0)).toBe(false);
    expect(verifyUploadToken('', claims, 's', T0)).toBe(false);
  });
});

describe('video keys and types', () => {
  it('accepts only server-made video keys', () => {
    expect(isVideoStorageKey('videos/1700000000000-0123456789ab.webm')).toBe(true);
    expect(isVideoStorageKey('videos/../documents/x.mp4')).toBe(false);
    expect(isVideoStorageKey('videos/my-video.mp4')).toBe(false);
    expect(isVideoStorageKey('videos/1700000000000-0123456789ab.exe')).toBe(false);
  });

  it('maps allowed extensions to the type the bucket object gets', () => {
    expect(videoContentType('Bài 1.MOV')).toBe('video/quicktime');
    expect(videoContentType('bai.mkv')).toBe('video/x-matroska');
    expect(videoContentType('bai.exe')).toBeNull();
  });
});
