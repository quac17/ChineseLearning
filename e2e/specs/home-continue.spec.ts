import { APIRequestContext, expect, test } from '@playwright/test';
import { API_URL } from '../env';
import { apiAs } from '../fixtures/auth';
import { setAccess, uniq } from '../fixtures/data';
import { newStudent } from '../fixtures/payments';

// "Học tiếp" on the home page (AppHome board), driven by GET /progress/me.

const put = (api: APIRequestContext, lessonId: string, data: object) =>
  api.put(`${API_URL}/progress/lessons/${lessonId}`, { data });

async function courseWithLessons(studentId: string, count: number) {
  const teacher = await apiAs('teacher');
  const title = `E2E học tiếp ${uniq()}`;
  const course = await (await teacher.post('courses', { data: { title, module: 'yct', isFree: false } })).json();
  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    const res = await teacher.post('lessons/youtube', {
      data: { courseId: course.id, title: `Bài ${i}: học tiếp`, youtubeUrl: 'jNQXAC9IVRw', sortOrder: i, isFree: false },
    });
    expect(res.status(), await res.text()).toBe(201);
    ids.push((await res.json()).id);
  }
  await setAccess(teacher, course.id, studentId, true);
  return { courseId: course.id as string, title, lessonIds: ids };
}

test.describe('home "Học tiếp"', () => {
  test('logged out and a student without progress see no block', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'HSK' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Học tiếp' })).toHaveCount(0);

    await newStudent(page.request);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'HSK' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Học tiếp' })).toHaveCount(0);
  });

  test('shows courses in progress, not finished ones, and opens the lesson left half-way', async ({ page }) => {
    const student = await newStudent(page.request);
    const open = await courseWithLessons(student.id, 3);
    const finished = await courseWithLessons(student.id, 1);

    await put(page.request, finished.lessonIds[0], { completed: true });
    await put(page.request, open.lessonIds[0], { completed: true });
    await put(page.request, open.lessonIds[2], { positionSeconds: 30, durationSeconds: 100 });

    await page.goto('/');
    const block = page.getByRole('region', { name: 'Học tiếp' });
    const item = block.getByRole('link', { name: new RegExp(`${open.title} · Bài 3: học tiếp`) });
    await expect(item).toBeVisible();
    await expect(item.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
    await expect(item).toContainText('1 / 3 bài');
    await expect(block.getByText(finished.title)).toHaveCount(0);

    await item.click();
    await expect(page).toHaveURL(new RegExp(`/learn/${open.courseId}/${open.lessonIds[2]}$`));
  });

  test('at phone width the block sits right under the hero', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const student = await newStudent(page.request);
    const { lessonIds } = await courseWithLessons(student.id, 2);
    await put(page.request, lessonIds[0], { completed: true });

    await page.goto('/');
    const block = page.getByRole('region', { name: 'Học tiếp' });
    await expect(block).toContainText('Vừa học xong: Bài 1: học tiếp');
    const hero = await page.getByRole('heading', { level: 1 }).boundingBox();
    const box = await block.boundingBox();
    const tabs = await page.getByRole('tab', { name: 'HSK' }).boundingBox();
    expect(hero && box && tabs && hero.y < box.y && box.y < tabs.y).toBeTruthy();
    // No horizontal scroll at 375px.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
