import { APIRequestContext, expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { SEED, apiAs } from '../fixtures/auth';
import { setAccess, uniq } from '../fixtures/data';
import { newStudent } from '../fixtures/payments';

// Progress is per learner, so every test uses a fresh student.

const put = (api: APIRequestContext, lessonId: string, data: object) =>
  api.put(`${API_URL}/progress/lessons/${lessonId}`, { data });

/** A course with three YouTube lessons, opened for `studentId`. */
async function courseWithLessons(studentId: string) {
  const teacher = await apiAs('teacher');
  const course = await (
    await teacher.post('courses', { data: { title: `E2E tiến độ ${uniq()}`, module: 'hsk', isFree: false } })
  ).json();
  const ids: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const res = await teacher.post('lessons/youtube', {
      data: { courseId: course.id, title: `Bài ${i}: thử tiến độ`, youtubeUrl: 'jNQXAC9IVRw', sortOrder: i, isFree: false },
    });
    expect(res.status(), await res.text()).toBe(201);
    ids.push((await res.json()).id);
  }
  await setAccess(teacher, course.id, studentId, true);
  return { courseId: course.id as string, lessonIds: ids };
}

test.describe('progress API', () => {
  test('tick, untick, 90% rule, and access checks', async () => {
    const api = await request.newContext();
    await newStudent(api);

    // Paid lesson without access → 403; anonymous → 401.
    expect((await put(api, SEED.hsk1PaidLesson, { completed: true })).status()).toBe(403);
    expect((await (await request.newContext()).get(`${API_URL}/progress/me`)).status()).toBe(401);

    const lesson = SEED.hsk1FreeLesson;
    expect(await (await put(api, lesson, { completed: true })).json()).toMatchObject({ completed: true });
    expect(await (await put(api, lesson, { completed: false })).json()).toMatchObject({ completed: false });

    // Uploaded-video positions: below 90% keeps it open, at 90% completes it,
    // seeking back afterwards does not undo it.
    expect(await (await put(api, lesson, { positionSeconds: 50, durationSeconds: 100 })).json()).toMatchObject({
      completed: false,
      positionSeconds: 50,
    });
    expect(await (await put(api, lesson, { positionSeconds: 90, durationSeconds: 100 })).json()).toMatchObject({
      completed: true,
    });
    expect(await (await put(api, lesson, { positionSeconds: 5, durationSeconds: 100 })).json()).toMatchObject({
      completed: true,
      positionSeconds: 5,
    });

    const course = await (await api.get(`${API_URL}/progress/courses/${SEED.hsk1}`)).json();
    expect(course).toMatchObject({ totalLessons: 2, completedCount: 1, lastLessonId: lesson });

    const mine = await (await api.get(`${API_URL}/progress/me`)).json();
    expect(mine).toEqual([expect.objectContaining({ courseId: SEED.hsk1, completedCount: 1, totalLessons: 2 })]);

    // Bad input is rejected.
    expect((await put(api, lesson, { positionSeconds: -1 })).status()).toBe(400);
  });
});

test.describe('progress in the browser', () => {
  test('mark a lesson done in the player; my courses shows it finished', async ({ page }) => {
    await newStudent(page.request);

    await page.goto('/learn/course-easy1/lesson-easy1-b1');
    await page.getByRole('button', { name: 'Đánh dấu đã học' }).click();
    await expect(page.getByRole('button', { name: '✓ Đã học' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Đã học: 1\./ })).toBeChecked();

    await page.reload();
    await expect(page.getByRole('button', { name: '✓ Đã học' })).toBeVisible();

    // A free course the learner started shows up in "my courses", finished.
    await page.goto('/my-courses');
    await expect(page.getByRole('tab', { name: 'Đã xong (1)' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Easy Steps.*Đã hoàn thành/ })).toBeVisible();
  });

  test('"Học tiếp" opens the next unfinished lesson, or the one left half-way', async ({ page }) => {
    const student = await newStudent(page.request);
    const { courseId, lessonIds } = await courseWithLessons(student.id);

    await put(page.request, lessonIds[0], { completed: true });
    await page.goto(`/learn/${courseId}`);
    await expect(page).toHaveURL(new RegExp(`/learn/${courseId}/${lessonIds[1]}$`));

    // Left lesson 3 half-way: that is where to continue.
    await put(page.request, lessonIds[2], { positionSeconds: 30, durationSeconds: 100 });
    await page.goto('/my-courses');
    const resume = page.getByRole('region', { name: 'Học tiếp' });
    await expect(resume).toContainText('Bài 3: thử tiến độ');
    await expect(resume).toContainText('Dừng ở 00:30 / 01:40');
    await resume.getByRole('link', { name: 'Học tiếp' }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${courseId}/${lessonIds[2]}$`));

    // Progress bar text on the card.
    await page.goto('/my-courses');
    await expect(page.getByRole('progressbar', { name: /Tiến độ E2E tiến độ/ })).toHaveAttribute('aria-valuenow', '33');
  });
});
