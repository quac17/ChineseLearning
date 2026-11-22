import { APIRequestContext, expect } from '@playwright/test';

/** Unique suffix so parallel specs never collide on titles or emails. */
export const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Creates a paid course owned by the caller with one uploaded (paid) video
 * lesson and one paid document, so access specs never touch seed rows that
 * other specs read.
 */
export async function createPaidCourse(teacher: APIRequestContext) {
  const tag = uniq();
  const courseRes = await teacher.post('courses', {
    data: { title: `E2E khoá trả phí ${tag}`, module: 'hsk', isFree: false, isPublished: true },
  });
  expect(courseRes.status(), await courseRes.text()).toBe(201);
  const course = await courseRes.json();

  const lessonRes = await teacher.post('lessons/upload', {
    multipart: {
      courseId: course.id,
      title: `E2E bài trả phí ${tag}`,
      isFree: 'false',
      // The server checks the extension, not the codec; a few bytes are enough.
      file: { name: 'e2e.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(2048, 1) },
    },
  });
  expect(lessonRes.status(), await lessonRes.text()).toBe(201);
  const lesson = await lessonRes.json();

  const docRes = await teacher.post('documents/upload', {
    multipart: {
      courseId: course.id,
      title: `E2E tài liệu ${tag}`,
      isFree: 'false',
      file: { name: 'e2e.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.alloc(512, 1) },
    },
  });
  expect(docRes.status(), await docRes.text()).toBe(201);
  const doc = await docRes.json();

  return { courseId: course.id as string, lessonId: lesson.id as string, docId: doc.id as string };
}

export async function setAccess(
  teacher: APIRequestContext,
  courseId: string,
  studentId: string,
  canView: boolean,
) {
  const res = await teacher.post('enrollments/access', { data: { courseId, studentId, canView } });
  expect(res.ok(), await res.text()).toBeTruthy();
}
