import { APIRequestContext, expect, test } from '@playwright/test';
import { SEED, anonymousApi, apiAs, storageStateFor } from '../fixtures/auth';
import { createPaidCourse, setAccess, uniq } from '../fixtures/data';
import { API_URL } from '../env';

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

test.describe('learner pages show the locked state', () => {
  test('logged out: course page offers the preview, player locks the paid lesson', async ({ page }) => {
    await page.goto(`/courses/${SEED.hsk1}`);
    await expect(page.getByRole('heading', { level: 1, name: /HSK 1/ })).toBeVisible();
    const curriculum = page.getByRole('region', { name: 'Nội dung khoá học' });
    await expect(curriculum.getByRole('link', { name: 'Xem thử' })).toBeVisible();
    // The paid lesson is listed but not linked.
    await expect(curriculum.getByRole('link', { name: /Bài 2: Giới thiệu bản thân/ })).toHaveCount(0);

    await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1PaidLesson}`);
    await expect(page.getByRole('heading', { name: 'Bài học này đã khoá' })).toBeVisible();
    await expect(page.locator('iframe, video')).toHaveCount(0);
  });

  test('old /courses?courseId= links open the course page', async ({ page }) => {
    await page.goto(`/courses?courseId=${SEED.hsk1}`);
    await expect(page).toHaveURL(new RegExp(`/courses/${SEED.hsk1}$`));
  });

  test.describe('as studentA', () => {
    test.use({ storageState: storageStateFor('studentA') });

    test('plays the paid HSK 1 lesson', async ({ page }) => {
      await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1PaidLesson}`);
      await expect(page.getByRole('heading', { level: 1, name: /Giới thiệu bản thân/ })).toBeVisible();
      await expect(page.locator('iframe[title*="Giới thiệu bản thân"]')).toBeVisible();
    });

    test('my courses lists HSK 1 and opens the player', async ({ page }) => {
      await page.goto('/my-courses');
      await page.getByRole('link', { name: /HSK 1/ }).click();
      await expect(page).toHaveURL(new RegExp(`/learn/${SEED.hsk1}/[^/]+$`));
    });
  });

  test('a new student sees an empty my-courses page', async ({ page }) => {
    // A fresh account: studentB can be granted access by a parallel spec.
    // page.request shares the browser's cookies, so this also logs the page in.
    const res = await page.request.post(`${API_URL}/auth/register`, {
      data: { fullName: 'Học viên mới', email: `moi-${uniq()}@e2e.test`, password: 'Matkhau@123' },
    });
    expect(res.status(), await res.text()).toBe(201);
    await page.goto('/my-courses');
    await expect(page.getByRole('heading', { name: 'Bạn chưa có khoá học nào' })).toBeVisible();
  });
});
