import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StorageService } from '../common/storage/storage.service';
import { CoursesService } from '../courses/courses.service';
import { DocumentsService } from '../documents/documents.service';
import { Role } from '../common/types/domain.types';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { LessonsService } from './lessons.service';
import { signUploadToken } from './video-upload';

/**
 * Paid media on the bucket: a signed URL is issued only after the access
 * check (video-access skill, "Must-have tests"). The GCS client is mocked.
 */
const mockFile = {
  getSignedUrl: jest.fn(async (_opts: Record<string, unknown>) => ['https://storage.googleapis.com/vk/obj?X-Goog-Signature=sig']),
  exists: jest.fn(async () => [true]),
  getMetadata: jest.fn(async () => [{ size: '4096', contentType: 'video/mp4' }]),
  delete: jest.fn(async (_opts?: unknown) => undefined),
};
const mockBucket = { file: jest.fn((_name: string) => mockFile), upload: jest.fn() };
jest.mock('@google-cloud/storage', () => ({ Storage: jest.fn(() => ({ bucket: () => mockBucket })) }));

const SECRET = 'test-secret';
const NOW = Date.parse('2026-11-22T10:00:00Z');
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-media-'));
const env: Record<string, string> = { STORAGE_BACKEND: 'gcs', GCS_BUCKET: 'vk', UPLOAD_DIR: uploadDir, JWT_SECRET: SECRET };
const config = { get: (k: string) => env[k] } as any;

const user = (id: string, role: Role): AuthUser => ({ id, role, email: `${id}@chineselearner.vn`, fullName: id, phone: null, bio: null });
const admin = user('admin', Role.ADMIN);
const owner = user('teacher', Role.TEACHER);
const otherTeacher = user('teacher2', Role.TEACHER);
const studentA = user('studentA', Role.STUDENT);
const studentB = user('studentB', Role.STUDENT);

const VIDEO_KEY = 'videos/1700000000000-0123456789ab.mp4';
const course = { id: 'course_hsk1', is_free: false, teacher_id: 'teacher' };
const paidLesson = { id: 'lesson_paid', course_id: course.id, is_free: false, source_type: 'UPLOAD', storage_key: VIDEO_KEY, mime_type: 'video/mp4' };
const freeLesson = { ...paidLesson, id: 'lesson_free', is_free: true };
const paidDoc = { id: 'doc_paid', course_id: course.id, is_free: false, storage_key: 'documents/1-0123456789ab.docx', mime_type: 'application/msword', original_file_name: 'Bài 1.docx' };

let canView: Record<string, boolean>;
let usedKeys: Set<string>;

const db = {
  queryOne: jest.fn(async (sql: string, params: any[] = []) => {
    if (sql.includes('FROM lessons WHERE id')) return [paidLesson, freeLesson].find((l) => l.id === params[0]) ?? null;
    if (sql.includes('FROM lessons WHERE storage_key')) return usedKeys.has(params[0]) ? { id: 'x' } : null;
    if (sql.includes('FROM course_documents WHERE id')) return params[0] === paidDoc.id ? paidDoc : null;
    if (sql.includes('FROM courses WHERE id')) return params[0] === course.id ? course : null;
    if (sql.includes('FROM course_enrollments')) return params[1] in canView ? { can_view: canView[params[1]] } : null;
    if (sql.includes('MAX(sort_order)')) return { max_order: 0 };
    if (sql.startsWith('INSERT INTO lessons')) return { id: params[0], course_id: params[1], storage_key: params[8], file_size: params[11] };
    if (sql.trim().startsWith('UPDATE lessons')) return { id: params[9], storage_key: params[5] };
    throw new Error(`unexpected SQL: ${sql}`);
  }),
} as any;

function fakeRes() {
  const res: any = { headers: {} as Record<string, string> };
  res.setHeader = jest.fn((k: string, v: string) => (res.headers[k] = v));
  res.redirect = jest.fn();
  return res;
}

let storage: StorageService;
let lessons: LessonsService;
let documents: DocumentsService;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  canView = { studentA: true };
  usedKeys = new Set();
  storage = new StorageService(config);
  const courses = new CoursesService(db, storage);
  lessons = new LessonsService(db, courses, {} as any, storage, config);
  documents = new DocumentsService(db, courses, storage);
});
afterEach(() => jest.restoreAllMocks());

describe('GET /lessons/:id/stream on the bucket', () => {
  const stream = (lessonId: string, who: AuthUser | null) => {
    const res = fakeRes();
    return lessons.streamVideo(lessonId, who, { headers: {} } as any, res).then(() => res);
  };

  it.each([
    ['logged out', null],
    ['studentB (no enrollment)', studentB],
    ['another teacher', otherTeacher],
  ])('%s gets 403 on a paid lesson and no URL is signed', async (_, who) => {
    await expect(stream(paidLesson.id, who)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockFile.getSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['studentA (enrolled)', studentA],
    ['the owner teacher', owner],
    ['an admin', admin],
  ])('%s is redirected to a 15-minute signed URL', async (_, who) => {
    const res = await stream(paidLesson.id, who);
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://storage.googleapis.com/vk/obj?X-Goog-Signature=sig');
    expect(res.headers['Cache-Control']).toBe('private, no-store');
    expect(mockBucket.file).toHaveBeenCalledWith(VIDEO_KEY);
    expect(mockFile.getSignedUrl.mock.calls[0][0]).toMatchObject({ version: 'v4', action: 'read', expires: NOW + 15 * 60_000 });
  });

  it('a free preview lesson is signed for anyone', async () => {
    const res = await stream(freeLesson.id, null);
    expect(res.redirect).toHaveBeenCalledTimes(1);
  });

  it('revoking the enrollment (can_view = false) closes it again', async () => {
    canView.studentA = false;
    await expect(stream(paidLesson.id, studentA)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockFile.getSignedUrl).not.toHaveBeenCalled();
  });
});

describe('GET /documents/:id/download on the bucket', () => {
  it('403 without access, no URL signed', async () => {
    await expect(documents.download(paidDoc.id, studentB, fakeRes())).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockFile.getSignedUrl).not.toHaveBeenCalled();
  });

  it('with access: redirect to a signed URL that downloads under the original name', async () => {
    const res = fakeRes();
    await documents.download(paidDoc.id, studentA, res);
    expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('X-Goog-Signature'));
    expect(mockFile.getSignedUrl.mock.calls[0][0].responseDisposition).toMatch(/^attachment; .*filename\*=UTF-8''B%C3%A0i%201\.docx$/);
  });
});

describe('direct video upload', () => {
  const request = { courseId: course.id, fileName: 'bai-1.mp4', contentType: 'video/mp4', fileSize: 4096 };

  it('signs a PUT URL only for a teacher who manages the course', async () => {
    await expect(lessons.requestVideoUpload(request, otherTeacher)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockFile.getSignedUrl).not.toHaveBeenCalled();

    const out: any = await lessons.requestVideoUpload(request, owner);
    expect(out).toMatchObject({ direct: true, method: 'PUT', headers: { 'Content-Type': 'video/mp4' } });
    expect(out.storageKey).toMatch(/^videos\/\d+-[a-f0-9]{12}\.mp4$/);
    expect(mockFile.getSignedUrl.mock.calls[0][0]).toMatchObject({ version: 'v4', action: 'write', contentType: 'video/mp4' });
  });

  it.each([
    ['a non-video extension', { fileName: 'bai.exe' }],
    ['a non-video MIME type', { contentType: 'text/html' }],
    ['a file over MAX_VIDEO_SIZE_MB', { fileSize: 501 * 1024 * 1024 }],
  ])('refuses %s before signing', async (_, patch) => {
    await expect(lessons.requestVideoUpload({ ...request, ...patch }, owner)).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFile.getSignedUrl).not.toHaveBeenCalled();
  });

  it('on the local backend it tells the client to use multipart', async () => {
    const local = new StorageService({ get: (k: string) => ({ ...env, STORAGE_BACKEND: 'local' })[k] } as any);
    const svc = new LessonsService(db, new CoursesService(db, local), {} as any, local, config);
    await expect(svc.requestVideoUpload(request, owner)).resolves.toEqual({ direct: false });
  });

  const confirm = (patch: Record<string, unknown> = {}) => ({
    courseId: course.id,
    title: 'Bài 1',
    storageKey: VIDEO_KEY,
    uploadToken: signUploadToken({ userId: owner.id, courseId: course.id, storageKey: VIDEO_KEY }, SECRET, NOW),
    originalFileName: 'bài 1.mp4',
    ...patch,
  });

  it('confirm creates the lesson with the size read from the bucket', async () => {
    const lesson = await lessons.confirmUploadedLesson(confirm() as any, owner);
    expect(lesson).toMatchObject({ storage_key: VIDEO_KEY, file_size: 4096 });
  });

  it.each([
    ['a token for another key', { storageKey: 'videos/1700000000000-ffffffffffff.mp4' }],
    ['a forged token', { uploadToken: `${NOW}.${'0'.repeat(64)}` }],
    ['a key outside videos/', { storageKey: 'documents/1700000000000-0123456789ab.mp4' }],
  ])('confirm refuses %s and leaves the object alone', async (_, patch) => {
    await expect(lessons.confirmUploadedLesson(confirm(patch) as any, owner)).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFile.delete).not.toHaveBeenCalled();
  });

  it('confirm refuses a token issued to another teacher', async () => {
    await expect(lessons.confirmUploadedLesson(confirm() as any, otherTeacher)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirm deletes an oversized object', async () => {
    mockFile.getMetadata.mockResolvedValueOnce([{ size: String(600 * 1024 * 1024), contentType: 'video/mp4' }]);
    await expect(lessons.confirmUploadedLesson(confirm() as any, owner)).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFile.delete).toHaveBeenCalled();
  });

  it('confirm refuses a key that a lesson already uses', async () => {
    usedKeys.add(VIDEO_KEY);
    await expect(lessons.confirmUploadedLesson(confirm() as any, owner)).rejects.toThrow(/đã được gắn/);
  });

  it('replacing a video confirms against the lesson course and removes the old object', async () => {
    const newKey = 'videos/1700000000001-0123456789ab.mp4';
    const dto = confirm({
      storageKey: newKey,
      uploadToken: signUploadToken({ userId: owner.id, courseId: course.id, storageKey: newKey }, SECRET, NOW),
    });
    await expect(lessons.confirmReplacedVideo(paidLesson.id, dto as any, owner)).resolves.toMatchObject({ storage_key: newKey });
    expect(mockBucket.file).toHaveBeenCalledWith(VIDEO_KEY);
    expect(mockFile.delete).toHaveBeenCalledTimes(1);
  });
});
