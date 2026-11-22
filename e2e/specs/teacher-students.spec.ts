import { expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { apiAs, storageStateFor } from '../fixtures/auth';
import { createPaidCourse, uniq } from '../fixtures/data';
import { checkout, newStudent, orderCodeOf, postWebhook, signedWebhook } from '../fixtures/payments';

// Students tab (grant / revoke through the UI) and the read-only "Giá & bán" tab.

test.use({ storageState: storageStateFor('teacher') });

test('teacher grants a fresh student through the UI, who can then play the paid lesson; revoke locks it', async ({ page, browser }) => {
  const { courseId, lessonId } = await createPaidCourse(await apiAs('teacher'));

  // A brand-new student (like studentB, but never touched by other specs), logged in on its own browser context.
  const learner = await browser.newContext();
  const email = `cap-${uniq()}@e2e.test`;
  const reg = await learner.request.post(`${API_URL}/auth/register`, {
    data: { fullName: `Học viên cấp quyền ${uniq()}`, email, password: 'Matkhau@123', acceptTerms: true },
  });
  expect(reg.status(), await reg.text()).toBe(201);
  const { user } = await reg.json();
  const player = await learner.newPage();
  await player.goto(`/learn/${courseId}/${lessonId}`);
  await expect(player.getByRole('heading', { name: 'Bài học này đã khoá' })).toBeVisible();

  await page.goto(`/teacher/courses/${courseId}/students`);
  await expect(page.getByRole('heading', { name: 'Học viên có quyền (0)' })).toBeVisible();
  await page.getByLabel('Tìm học viên theo tên, email hoặc số điện thoại').fill(email);
  const results = page.getByRole('list', { name: 'Kết quả tìm học viên' });
  await results.getByRole('button', { name: `Cấp quyền cho ${user.fullName}` }).click();
  await expect(page.getByText(`Đã cấp quyền cho ${user.fullName}`)).toBeVisible();

  const row = page.getByRole('row', { name: new RegExp(email) });
  await expect(row).toContainText('Cấp thủ công');
  await expect(row).toContainText('0/1 bài');
  await expect(page.getByRole('heading', { name: 'Học viên có quyền (1)' })).toBeVisible();

  await player.reload();
  await expect(player.locator('video')).toBeVisible();
  expect((await learner.request.get(`${API_URL}/lessons/${lessonId}/stream`)).status()).toBe(200);

  await row.getByRole('button', { name: `Thu hồi quyền của ${user.fullName}` }).click();
  const dialog = page.getByRole('dialog', { name: `Thu hồi quyền của ${user.fullName}?` });
  await dialog.getByRole('button', { name: 'Thu hồi quyền' }).click();
  await expect(page.getByText(`Đã thu hồi quyền của ${user.fullName}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Học viên có quyền (0)' })).toBeVisible();
  expect((await learner.request.get(`${API_URL}/lessons/${lessonId}/stream`)).status()).toBe(403);
  await learner.close();
});

test('a PayOS buyer shows as "Đã mua" with the order code, never the amount', async ({ page }) => {
  const teacher = await apiAs('teacher');
  const { courseId } = await createPaidCourse(teacher);
  const admin = await apiAs('admin');
  expect((await admin.patch(`courses/${courseId}/price`, { data: { priceVnd: 123000 } })).ok()).toBeTruthy();

  const buyer = await request.newContext();
  const { email } = await newStudent(buyer);
  const order = await (await checkout(buyer, courseId)).json();
  const code = orderCodeOf(order);
  expect(await (await postWebhook(buyer, signedWebhook(code, 123000, `E2E-GV-${code}`))).json()).toMatchObject({ outcome: 'GRANTED' });

  // The API gives the teacher the order code and progress, no money.
  const list = await (await teacher.get(`enrollments/course/${courseId}`)).json();
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ email, paidOrderCode: order.code, completedLessons: 0 });
  expect(JSON.stringify(list)).not.toContain('123000');

  await page.goto(`/teacher/courses/${courseId}/students`);
  const row = page.getByRole('row', { name: new RegExp(email) });
  await expect(row).toContainText('Đã mua');
  await expect(row).toContainText(order.code);
  await page.getByLabel('Lọc nguồn').selectOption('manual');
  await expect(page.getByRole('heading', { name: 'Không có học viên nào khớp' })).toBeVisible();

  await row.page().getByLabel('Lọc nguồn').selectOption('paid');
  await row.getByRole('button', { name: /Thu hồi quyền/ }).click();
  await expect(page.getByRole('dialog')).toContainText(`đơn ${order.code}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Huỷ' }).click();

  // "Giá & bán" shows the admin's price, read-only, with no revenue.
  await page.getByRole('link', { name: 'Giá & bán' }).click();
  await expect(page.getByText('123.000 ₫')).toBeVisible();
  await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('spinbutton')).toHaveCount(0);
  await expect(page.getByText('Khu giáo viên không hiển thị doanh thu.')).toBeVisible();
  // The API still refuses a teacher's price change.
  expect((await teacher.patch(`courses/${courseId}/price`, { data: { priceVnd: 1000 } })).status()).toBe(403);
});
