import { APIRequestContext, expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { SEED, anonymousApi, apiAs, storageStateFor } from '../fixtures/auth';
import { setAccess, uniq } from '../fixtures/data';
import { newStudent } from '../fixtures/payments';

/** A fresh published paid course owned by the seed teacher, so specs never share reviews. */
async function newPaidCourse(isFree = false) {
  const teacher = await apiAs('teacher');
  const res = await teacher.post('courses', {
    data: { title: `E2E đánh giá thật ${uniq()}`, module: 'talk', isFree, isPublished: true },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: string; title: string };
}

/** A brand-new student with open access to `courseId` (granted by the teacher). */
async function buyer(courseId: string): Promise<APIRequestContext & { studentId: string }> {
  const api = await request.newContext({ baseURL: `${API_URL}/`, storageState: { cookies: [], origins: [] } });
  const student = await newStudent(api);
  await setAccess(await apiAs('teacher'), courseId, student.id, true);
  return Object.assign(api, { studentId: student.id });
}

async function review(api: APIRequestContext, courseId: string, stars: number, comment?: string) {
  const res = await api.put(`courses/${courseId}/reviews/mine`, { data: { stars, comment } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).review as { id: string };
}

async function summary(courseId: string) {
  const course = await (await (await anonymousApi()).get(`courses/${courseId}`)).json();
  return course.reviews as { average: number | null; count: number };
}

test.describe('course reviews API (#41)', () => {
  test('only learners with access to a paid course may review', async () => {
    const course = await newPaidCourse();
    const body = { data: { stars: 5, comment: 'Rất hay' } };

    const studentB = await apiAs('studentB');
    const refused = await studentB.put(`courses/${course.id}/reviews/mine`, body);
    expect(refused.status()).toBe(403);
    expect((await refused.json()).message).toBe('Chỉ học viên đã mua khoá học mới đánh giá được.');
    expect((await studentB.get(`courses/${course.id}/reviews/mine`)).ok()).toBeTruthy();
    await expect((await studentB.get(`courses/${course.id}/reviews/mine`)).json()).resolves.toMatchObject({ canReview: false, review: null });

    expect((await (await apiAs('teacher')).put(`courses/${course.id}/reviews/mine`, body)).status()).toBe(403);
    expect((await (await anonymousApi()).put(`courses/${course.id}/reviews/mine`, body)).status()).toBe(401);

    const free = await newPaidCourse(true);
    const freeLearner = await buyer(free.id);
    const freeRes = await freeLearner.put(`courses/${free.id}/reviews/mine`, body);
    expect(freeRes.status()).toBe(403);
    expect((await freeRes.json()).message).toContain('miễn phí');

    const learner = await buyer(course.id);
    expect((await learner.put(`courses/${course.id}/reviews/mine`, { data: { stars: 6 } })).status()).toBe(400);
    await review(learner, course.id, 4, 'Bài giảng rõ ràng');
    // A second save edits the same review: still one per learner.
    await review(learner, course.id, 5, '  Sửa lại: rất hay  ');
    const list = await (await (await anonymousApi()).get(`courses/${course.id}/reviews`)).json();
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ stars: 5, comment: 'Sửa lại: rất hay', reply: null });
    expect(list.items[0]).not.toHaveProperty('studentId');
  });

  test('average appears from 3 reviews; hiding one removes it from list and average', async () => {
    const course = await newPaidCourse();
    const [a, b, c] = await Promise.all([buyer(course.id), buyer(course.id), buyer(course.id)]);
    await review(a, course.id, 5);
    await review(b, course.id, 4);
    expect(await summary(course.id)).toEqual({ average: null, count: 2 });
    const third = await review(c, course.id, 3, 'Quảng cáo trang khác');
    expect(await summary(course.id)).toEqual({ average: 4, count: 3 });

    const admin = await apiAs('admin');
    expect((await admin.patch(`admin/reviews/${third.id}/hidden`, { data: { hidden: true } })).status()).toBe(400);
    expect(
      (await (await apiAs('teacher')).patch(`admin/reviews/${third.id}/hidden`, { data: { hidden: true, reason: 'Vi phạm' } })).status(),
    ).toBe(403);
    const hidden = await admin.patch(`admin/reviews/${third.id}/hidden`, { data: { hidden: true, reason: 'Quảng cáo' } });
    expect(hidden.ok(), await hidden.text()).toBeTruthy();
    expect((await hidden.json()).summary).toEqual({ average: null, count: 2 });
    expect(await summary(course.id)).toEqual({ average: null, count: 2 });

    const pub = await (await (await anonymousApi()).get(`courses/${course.id}/reviews`)).json();
    expect(pub.items.map((r: { id: string }) => r.id)).not.toContain(third.id);
    // The author still sees theirs, marked hidden with the reason.
    await expect((await c.get(`courses/${course.id}/reviews/mine`)).json()).resolves.toMatchObject({
      review: { id: third.id, isHidden: true, hiddenReason: 'Quảng cáo' },
    });
    // The teacher sees it too, marked hidden.
    const managed = await (await (await apiAs('teacher')).get(`courses/${course.id}/reviews/manage`)).json();
    expect(managed.total).toBe(3);

    await admin.patch(`admin/reviews/${third.id}/hidden`, { data: { hidden: false } });
    expect(await summary(course.id)).toEqual({ average: 4, count: 3 });
  });

  test('the course teacher or an admin replies; nobody else', async () => {
    const course = await newPaidCourse();
    const learner = await buyer(course.id);
    const mine = await review(learner, course.id, 4, 'Cần thêm bài tập');

    expect((await learner.put(`reviews/${mine.id}/reply`, { data: { body: 'Tự trả lời' } })).status()).toBe(403);
    const teacher = await apiAs('teacher');
    expect((await teacher.put(`reviews/${mine.id}/reply`, { data: { body: '   ' } })).status()).toBe(400);
    const ok = await teacher.put(`reviews/${mine.id}/reply`, { data: { body: 'Cảm ơn bạn, cô sẽ bổ sung.' } });
    expect(ok.ok(), await ok.text()).toBeTruthy();
    const pub = await (await (await anonymousApi()).get(`courses/${course.id}/reviews`)).json();
    expect(pub.items[0].reply.body).toBe('Cảm ơn bạn, cô sẽ bổ sung.');

    // Losing access keeps the review but stops edits; the author may still delete it.
    await setAccess(teacher, course.id, learner.studentId, false);
    expect((await learner.put(`courses/${course.id}/reviews/mine`, { data: { stars: 1 } })).status()).toBe(403);
    expect((await learner.delete(`courses/${course.id}/reviews/mine`)).ok()).toBeTruthy();
    expect((await summary(course.id)).count).toBe(0);
  });
});

test.describe('course reviews in the pages', () => {
  test.describe('as an enrolled learner', () => {
    test.use({ storageState: storageStateFor('studentB') });

    test('writes, sees and edits their review on the course page', async ({ page }) => {
      const course = await newPaidCourse();
      await setAccess(await apiAs('teacher'), course.id, SEED.studentBId, true);

      await page.goto(`/courses/${course.id}`);
      const form = page.getByRole('form', { name: 'Đánh giá khoá học' });
      await expect(form).toBeVisible();
      await expect(form.getByRole('button', { name: 'Gửi đánh giá' })).toBeDisabled();
      await form.getByRole('radio', { name: '4 sao' }).check();
      await form.getByLabel('Nhận xét (không bắt buộc)').fill('Cô giảng dễ hiểu, phát âm chuẩn.');
      await form.getByRole('button', { name: 'Gửi đánh giá' }).click();

      await expect(page.getByText('Cảm ơn bạn đã đánh giá')).toBeVisible();
      const mine = page.getByRole('region', { name: 'Đánh giá của bạn' });
      await expect(mine.getByText('Cô giảng dễ hiểu, phát âm chuẩn.')).toBeVisible();
      await expect(page.getByRole('list', { name: 'Đánh giá của học viên' })).toContainText('Cô giảng dễ hiểu');
      // One review: no average yet.
      await expect(page.getByText('1 đánh giá. Điểm trung bình hiện khi có từ 3 đánh giá.')).toBeVisible();
      await expect(page.getByTestId('hero-reviews')).toHaveCount(0);

      await mine.getByRole('button', { name: 'Sửa đánh giá' }).click();
      await page.getByRole('form', { name: 'Đánh giá khoá học' }).getByRole('radio', { name: '5 sao' }).check();
      await page.getByRole('button', { name: 'Lưu đánh giá' }).click();
      await expect(page.getByText('Đã lưu đánh giá')).toBeVisible();
      await expect(mine.getByRole('img', { name: '5 trên 5 sao' })).toBeVisible();
    });

    test('a learner without access sees no form', async ({ page }) => {
      const course = await newPaidCourse();
      await page.goto(`/courses/${course.id}`);
      await expect(page.getByRole('heading', { name: 'Đánh giá của học viên' })).toBeVisible();
      await expect(page.getByText('Chưa có đánh giá nào.')).toBeVisible();
      await expect(page.getByRole('form', { name: 'Đánh giá khoá học' })).toHaveCount(0);
    });
  });

  test('the average block appears only from 3 reviews and stays apart from the survey rating', async ({ page }) => {
    const course = await newPaidCourse();
    const learners = await Promise.all([buyer(course.id), buyer(course.id), buyer(course.id)]);
    await review(learners[0], course.id, 5, 'Tuyệt');
    await review(learners[1], course.id, 4);
    const SOURCE = 'khảo sát 120 học viên lớp offline 2025';
    await (await apiAs('admin')).patch(`courses/${course.id}/rating`, { data: { ratingValue: 4.9, ratingSource: SOURCE } });

    await page.goto(`/courses/${course.id}`);
    await expect(page.getByText('2 đánh giá. Điểm trung bình hiện khi có từ 3 đánh giá.')).toBeVisible();
    await expect(page.getByTestId('review-summary')).toHaveCount(0);
    await expect(page.getByTestId('hero-reviews')).toHaveCount(0);

    await review(learners[2], course.id, 3);
    await page.reload();
    await expect(page.getByTestId('review-summary')).toContainText('4,0');
    await expect(page.getByTestId('review-summary')).toContainText('3 đánh giá của học viên đã mua');
    await expect(page.getByTestId('hero-reviews')).toHaveText(/4,0 ★\s*trên 5 sao · 3 đánh giá của học viên/);
    // The sourced survey number is still shown on its own, with its source.
    await expect(page.getByText(`· ${SOURCE}`)).toBeVisible();
    await expect(page.getByText('4,9', { exact: false }).first()).toBeVisible();
  });

  test.describe('as the teacher', () => {
    test.use({ storageState: storageStateFor('teacher') });

    test('replies from the course editor Đánh giá tab', async ({ page }) => {
      const course = await newPaidCourse();
      const learner = await buyer(course.id);
      await review(learner, course.id, 3, 'Video hơi nhỏ tiếng.');

      await page.goto(`/teacher/courses/${course.id}/reviews`);
      await expect(page.getByText('1 chưa trả lời')).toBeVisible();
      const item = page.getByRole('list', { name: 'Đánh giá', exact: true }).getByRole('listitem').filter({ hasText: 'Video hơi nhỏ tiếng.' });
      await item.getByRole('button', { name: 'Trả lời' }).click();
      await item.getByLabel('Câu trả lời của giáo viên').fill('Cảm ơn bạn, cô đã thu lại âm thanh.');
      await item.getByRole('button', { name: 'Gửi trả lời' }).click();
      await expect(page.getByText('Đã gửi câu trả lời')).toBeVisible();
      await expect(item.getByText('Giáo viên trả lời')).toBeVisible();

      await page.goto(`/courses/${course.id}`);
      await expect(page.getByRole('list', { name: 'Đánh giá của học viên' })).toContainText('Cảm ơn bạn, cô đã thu lại âm thanh.');
    });
  });

  test.describe('as admin', () => {
    test.use({ storageState: storageStateFor('admin') });

    test('hides a review with a reason and the average updates', async ({ page }) => {
      const course = await newPaidCourse();
      const learners = await Promise.all([buyer(course.id), buyer(course.id), buyer(course.id), buyer(course.id)]);
      await review(learners[0], course.id, 5);
      await review(learners[1], course.id, 5);
      await review(learners[2], course.id, 4);
      const spam = `Mua khoá rẻ hơn ở trang khác ${uniq()}`;
      await review(learners[3], course.id, 1, spam);
      expect(await summary(course.id)).toEqual({ average: 3.8, count: 4 });

      await page.goto('/admin/reviews');
      const item = page.getByRole('listitem').filter({ hasText: spam });
      await item.getByRole('button', { name: 'Ẩn đánh giá' }).click();
      const dialog = page.getByRole('dialog', { name: 'Ẩn đánh giá này?' });
      await expect(dialog.getByRole('button', { name: 'Ẩn đánh giá' })).toBeDisabled();
      await dialog.getByLabel('Lý do ẩn').fill('Quảng cáo trang khác');
      await dialog.getByRole('button', { name: 'Ẩn đánh giá' }).click();
      await expect(page.getByText('Đã ẩn đánh giá')).toBeVisible();
      await expect(item.getByText('Lý do ẩn: Quảng cáo trang khác')).toBeVisible();

      expect(await summary(course.id)).toEqual({ average: 4.7, count: 3 });
      await page.goto(`/courses/${course.id}`);
      await expect(page.getByTestId('review-summary')).toContainText('4,7');
      await expect(page.getByText(spam)).toHaveCount(0);
    });
  });
});
