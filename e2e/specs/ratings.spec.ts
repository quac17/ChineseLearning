import { expect, test } from '@playwright/test';
import { SEED, anonymousApi, apiAs, storageStateFor } from '../fixtures/auth';
import { setAccess, uniq } from '../fixtures/data';

const SOURCE = 'khảo sát 120 học viên lớp offline 2025';

async function newCourse() {
  const teacher = await apiAs('teacher');
  const res = await teacher.post('courses', { data: { title: `E2E đánh giá ${uniq()}`, module: 'talk', isFree: false } });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; title: string };
}

test.describe('ratings and learner counts API (#29)', () => {
  test('seed courses have no rating and count only open enrollments', async () => {
    const course = await (await (await anonymousApi()).get(`courses/${SEED.hsk1}`)).json();
    expect(course.rating).toBeNull();
    expect(course.offlineLearnerCount).toBeNull();
    expect(course.learnerCount).toBeGreaterThanOrEqual(1); // studentA, plus buyers from other specs
  });

  test('a rating is saved only with a real source; empty clears it', async () => {
    const admin = await apiAs('admin');
    const { id } = await newCourse();

    const noSource = await admin.patch(`courses/${id}/rating`, { data: { ratingValue: 4.8, ratingSource: '' } });
    expect(noSource.status()).toBe(400);
    expect((await noSource.json()).message).toContain('phải kèm nguồn thật');
    const vague = await admin.patch(`courses/${id}/rating`, { data: { ratingValue: 4.8, ratingSource: 'rất tốt' } });
    expect(vague.status()).toBe(400);
    const outOfRange = await admin.patch(`courses/${id}/rating`, { data: { ratingValue: 5.5, ratingSource: SOURCE } });
    expect(outOfRange.status()).toBe(400);

    const ok = await admin.patch(`courses/${id}/rating`, { data: { ratingValue: 4.5, ratingSource: SOURCE } });
    expect(ok.ok(), await ok.text()).toBeTruthy();
    expect((await ok.json()).rating).toEqual({ value: 4.5, source: SOURCE });
    await expect((await (await anonymousApi()).get(`courses/${id}`)).json()).resolves.toMatchObject({ rating: { value: 4.5, source: SOURCE } });

    const cleared = await admin.patch(`courses/${id}/rating`, { data: { ratingValue: null, ratingSource: null } });
    expect((await cleared.json()).rating).toBeNull();
  });

  test('only admins set ratings and offline counts', async () => {
    const { id } = await newCourse();
    const teacher = await apiAs('teacher');
    expect((await teacher.patch(`courses/${id}/rating`, { data: { ratingValue: 5, ratingSource: SOURCE } })).status()).toBe(403);
    expect((await teacher.patch(`courses/${id}/offline-learners`, { data: { offlineLearnerCount: 80 } })).status()).toBe(403);
    expect((await (await anonymousApi()).patch(`courses/${id}/rating`, { data: {} })).status()).toBe(401);
    // A teacher cannot sneak a rating in through the normal course update either.
    await teacher.patch(`courses/${id}`, { data: { ratingValue: 5, ratingSource: SOURCE, rating_value: 5 } });
    expect((await (await teacher.get(`courses/${id}`)).json()).rating).toBeNull();
  });

  test('learner count follows open enrollments; offline count stays separate', async () => {
    const admin = await apiAs('admin');
    const teacher = await apiAs('teacher');
    const { id } = await newCourse();
    const count = async () => {
      const c = await (await (await anonymousApi()).get(`courses/${id}`)).json();
      return [c.learnerCount, c.offlineLearnerCount];
    };
    expect(await count()).toEqual([0, null]);
    await setAccess(teacher, id, SEED.studentBId, true);
    expect(await count()).toEqual([1, null]);
    expect((await admin.patch(`courses/${id}/offline-learners`, { data: { offlineLearnerCount: 80 } })).ok()).toBeTruthy();
    expect(await count()).toEqual([1, 80]);
    await setAccess(teacher, id, SEED.studentBId, false);
    expect(await count()).toEqual([0, 80]);
    expect((await admin.patch(`courses/${id}/offline-learners`, { data: { offlineLearnerCount: 0 } })).status()).toBe(400);
    await admin.patch(`courses/${id}/offline-learners`, { data: { offlineLearnerCount: null } });
    expect(await count()).toEqual([0, null]);
  });
});

test.describe('ratings in the pages', () => {
  test('course page and catalog show rating with its source and learners apart', async ({ page }) => {
    const admin = await apiAs('admin');
    const teacher = await apiAs('teacher');
    const course = await newCourse();
    await setAccess(teacher, course.id, SEED.studentBId, true);
    await admin.patch(`courses/${course.id}/rating`, { data: { ratingValue: 4.5, ratingSource: SOURCE } });
    await admin.patch(`courses/${course.id}/offline-learners`, { data: { offlineLearnerCount: 80 } });

    await page.goto(`/courses/${course.id}`);
    await expect(page.getByText(`· ${SOURCE}`)).toBeVisible();
    await expect(page.getByText('4,5', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('1 học viên (+80 lớp offline)')).toBeVisible();

    await page.goto(`/courses?q=${encodeURIComponent(course.title)}`);
    const row = page.getByRole('region', { name: 'Kết quả' }).getByRole('listitem');
    await expect(row).toContainText(SOURCE);
    await expect(row).toContainText('1 học viên (+80 lớp offline)');
  });

  test('a course without a rating shows no stars', async ({ page }) => {
    await page.goto('/courses/course-easy1');
    await expect(page.getByText('★')).toHaveCount(0);
  });

  test.describe('as admin', () => {
    test.use({ storageState: storageStateFor('admin') });

    test('the ratings page refuses a value without a source, then saves both', async ({ page }) => {
      const course = await newCourse();
      await page.goto('/admin/ratings');
      const form = page.getByRole('form', { name: `Đánh giá của ${course.title}` });
      await form.getByLabel('Điểm (1–5)').fill('4,7');
      await expect(form.getByText('Cần nhập nguồn thật cho điểm này.')).toBeVisible();
      await expect(form.getByRole('button', { name: 'Lưu' })).toBeDisabled();

      await form.getByLabel('Nguồn đánh giá').fill(SOURCE);
      await form.getByLabel('Học viên offline').fill('80');
      await form.getByRole('button', { name: 'Lưu' }).click();
      await expect(page.getByText('Đã lưu đánh giá kèm nguồn')).toBeVisible();

      const saved = await (await (await anonymousApi()).get(`courses/${course.id}`)).json();
      expect(saved.rating).toEqual({ value: 4.7, source: SOURCE });
      expect(saved.offlineLearnerCount).toBe(80);
    });
  });
});
