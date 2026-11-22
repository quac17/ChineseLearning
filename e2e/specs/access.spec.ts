import { APIRequestContext, expect, test } from '@playwright/test';
import { SEED, anonymousApi, apiAs, storageStateFor } from '../fixtures/auth';
import { createPaidCourse, setAccess } from '../fixtures/data';

// Paid content is gated by course_enrollments.can_view. These checks hit the
// API directly: hiding a button is not access control.

async function lessonsOf(api: APIRequestContext, courseId: string) {
  const res = await api.get(`courses/${courseId}`);
  expect(res.ok()).toBeTruthy();
  const course = await res.json();
  return Object.fromEntries(course.lessons.map((l: any) => [l.id, l]));
}

test.describe('seed course HSK 1', () => {
  test('logged out: free lesson playable, paid lesson hidden', async () => {
    const lessons = await lessonsOf(await anonymousApi(), SEED.hsk1);
    expect(lessons[SEED.hsk1FreeLesson]).toMatchObject({ canWatch: true });
    expect(lessons[SEED.hsk1FreeLesson].youtubeId).toBeTruthy();
    expect(lessons[SEED.hsk1PaidLesson]).toMatchObject({ canWatch: false, youtubeId: null, youtubeUrl: null });
  });

  test('studentB (no access) cannot see the paid lesson', async () => {
    const lessons = await lessonsOf(await apiAs('studentB'), SEED.hsk1);
    expect(lessons[SEED.hsk1PaidLesson]).toMatchObject({ canWatch: false, youtubeId: null });
  });

  test('studentA (enrolled) can watch the paid lesson', async () => {
    const lessons = await lessonsOf(await apiAs('studentA'), SEED.hsk1);
    expect(lessons[SEED.hsk1PaidLesson]).toMatchObject({ canWatch: true });
    expect(lessons[SEED.hsk1PaidLesson].youtubeId).toBeTruthy();
  });
});

test.describe('uploaded paid lesson and document', () => {
  test('teacher grants then revokes studentB; stream and download follow', async () => {
    const teacher = await apiAs('teacher');
    const studentB = await apiAs('studentB');
    const anon = await anonymousApi();
    const { courseId, lessonId, docId } = await createPaidCourse(teacher);

    const stream = `lessons/${lessonId}/stream`;
    const download = `documents/${docId}/download`;

    // No access: the direct URLs are refused, not just hidden in the UI.
    expect((await anon.get(stream)).status()).toBe(403);
    expect((await studentB.get(stream)).status()).toBe(403);
    expect((await studentB.get(download)).status()).toBe(403);
    expect((await lessonsOf(studentB, courseId))[lessonId]).toMatchObject({ canWatch: false, streamPath: null });

    await setAccess(teacher, courseId, SEED.studentBId, true);
    expect((await studentB.get(stream)).status()).toBe(200);
    expect((await studentB.get(stream, { headers: { Range: 'bytes=0-99' } })).status()).toBe(206);
    expect((await studentB.get(download)).status()).toBe(200);
    expect((await lessonsOf(studentB, courseId))[lessonId]).toMatchObject({ canWatch: true });

    await setAccess(teacher, courseId, SEED.studentBId, false);
    expect((await studentB.get(stream)).status()).toBe(403);
    expect((await studentB.get(download)).status()).toBe(403);
    // Anyone else is still locked out.
    expect((await anon.get(stream)).status()).toBe(403);
  });

  test('the owner teacher and admin can always stream', async () => {
    const teacher = await apiAs('teacher');
    const { lessonId } = await createPaidCourse(teacher);
    expect((await teacher.get(`lessons/${lessonId}/stream`)).status()).toBe(200);
    expect((await (await apiAs('admin')).get(`lessons/${lessonId}/stream`)).status()).toBe(200);
  });
});

// The legacy /courses page has no roles on its rows, hence `.les`. The learner
// pages PR replaces this page and these locators.
test.describe('learner page shows the locked state', () => {
  test('logged out: paid HSK 1 lesson is marked locked', async ({ page }) => {
    await page.goto(`/courses?courseId=${SEED.hsk1}`);
    const paidRow = page.locator('.les', { hasText: 'Bài 2: Giới thiệu bản thân' });
    await expect(paidRow.getByText('Đã khóa')).toBeVisible();
    await expect(paidRow.getByRole('button', { name: 'Mở khóa' })).toBeVisible();
  });

  test.describe('as studentA', () => {
    test.use({ storageState: storageStateFor('studentA') });
    test('paid HSK 1 lesson is open', async ({ page }) => {
      await page.goto(`/courses?courseId=${SEED.hsk1}`);
      const paidRow = page.locator('.les', { hasText: 'Bài 2: Giới thiệu bản thân' });
      await expect(paidRow.getByText('Được xem')).toBeVisible();
    });
  });
});
