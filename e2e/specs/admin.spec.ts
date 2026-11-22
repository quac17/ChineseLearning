import { expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { anonymousApi, apiAs, storageStateFor } from '../fixtures/auth';
import { createPaidCourse, uniq } from '../fixtures/data';
import { checkout, newStudent, orderCodeOf, postWebhook, signedWebhook } from '../fixtures/payments';

const vnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
const num = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

test.describe('admin stats API', () => {
  test('only admins read stats, which include revenue', async () => {
    expect((await (await anonymousApi()).get('admin/stats')).status()).toBe(401);
    expect((await (await apiAs('studentB')).get('admin/stats')).status()).toBe(403);
    expect((await (await apiAs('teacher')).get('admin/stats')).status()).toBe(403);
    const admin = await apiAs('admin');
    expect((await admin.get('admin/stats?period=forever')).status()).toBe(400);
    for (const period of ['30d', 'month', 'year']) {
      const res = await admin.get(`admin/stats?period=${period}`);
      expect(res.ok(), await res.text()).toBeTruthy();
      expect((await res.json()).period).toBe(period);
    }
  });

  test('a paid order adds its amount to revenue and to the purchased access count', async () => {
    const admin = await apiAs('admin');
    const teacher = await apiAs('teacher');
    const { courseId } = await createPaidCourse(teacher);
    expect((await admin.patch(`courses/${courseId}/price`, { data: { priceVnd: 123000 } })).ok()).toBeTruthy();

    const before = await (await admin.get('admin/stats')).json();
    const buyer = await request.newContext();
    await newStudent(buyer);
    const order = await (await checkout(buyer, courseId)).json();
    const paid = await postWebhook(buyer, signedWebhook(orderCodeOf(order), 123000, `E2E-STATS-${order.code}`));
    expect(await paid.json()).toMatchObject({ outcome: 'GRANTED' });
    const after = await (await admin.get('admin/stats')).json();

    // Other specs may pay in parallel, so the deltas are lower bounds.
    expect(after.orders.revenueVnd - before.orders.revenueVnd).toBeGreaterThanOrEqual(123000);
    expect(after.orders.paid - before.orders.paid).toBeGreaterThanOrEqual(1);
    expect(after.enrollments.purchased - before.enrollments.purchased).toBeGreaterThanOrEqual(1);
    expect(after.enrollments.open).toBe(after.enrollments.purchased + after.enrollments.manual);
    expect(after.users.total).toBe(after.users.admins + after.users.teachers + after.users.students);
    const top = after.topCourses.find((c: { courseId: string }) => c.courseId === courseId);
    if (top) expect(top.revenueVnd).toBe(123000);
    const today = after.revenueSeries.points[after.revenueSeries.points.length - 1];
    expect(today.revenueVnd).toBeGreaterThanOrEqual(123000);
  });

  test('a teacher who owns courses and a buyer with orders cannot be deleted', async () => {
    const admin = await apiAs('admin');
    // A fresh teacher with one course, never the seed teacher (delete would cascade).
    const email = `gv-xoa-${uniq()}@e2e.test`;
    const created = await admin.post('users', {
      data: { email, password: 'Matkhau@123', fullName: 'Giáo viên có khoá', role: 'TEACHER' },
    });
    const { id } = await created.json();
    const teacher = await request.newContext({ baseURL: `${API_URL}/` });
    expect((await teacher.post('auth/login', { data: { email, password: 'Matkhau@123' } })).ok()).toBeTruthy();
    await createPaidCourse(teacher);
    const res = await admin.delete(`users/${id}`);
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/đang phụ trách 1 khoá học/);

    const buyer = await request.newContext();
    const student = await newStudent(buyer);
    expect((await checkout(buyer, 'course-yct1')).ok()).toBeTruthy();
    const refused = await admin.delete(`users/${student.id}`);
    expect(refused.status()).toBe(400);
    expect((await refused.json()).message).toMatch(/đã có đơn hàng/);
  });
});

test.describe('admin area in the UI', () => {
  test.use({ storageState: storageStateFor('admin') });

  test('the stats page shows the numbers the API returns', async ({ page }) => {
    const statsResponse = page.waitForResponse((r) => r.url().includes('/admin/stats?period=30d') && r.ok());
    await page.goto('/admin');
    const stats = await (await statsResponse).json();

    await expect(page.getByRole('heading', { name: 'Thống kê', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Thống kê' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('kpi-revenue')).toContainText(vnd(stats.orders.revenueVnd));
    await expect(page.getByTestId('kpi-paid')).toContainText(num(stats.orders.paid));
    await expect(page.getByTestId('kpi-paid')).toContainText(`${num(stats.orders.expired)} đơn hết hạn`);
    await expect(page.getByTestId('kpi-new-users')).toContainText(`tổng ${num(stats.users.total)} tài khoản`);
    await expect(page.getByTestId('kpi-enrollments')).toContainText(
      `${num(stats.enrollments.purchased)} mua · ${num(stats.enrollments.manual)} cấp tay`,
    );
    await expect(page.getByTestId('kpi-users')).toContainText(
      `${num(stats.users.admins)} admin · ${num(stats.users.teachers)} giáo viên · ${num(stats.users.students)} học viên`,
    );
    await expect(page.getByTestId('kpi-courses')).toContainText(num(stats.courses.total));
    await expect(page.getByTestId('kpi-lessons')).toContainText(num(stats.courses.lessons));

    // Switching the period refetches.
    const yearResponse = page.waitForResponse((r) => r.url().includes('/admin/stats?period=year') && r.ok());
    await page.getByLabel('Khoảng thời gian').selectOption('year');
    const year = await (await yearResponse).json();
    await expect(page.getByTestId('kpi-revenue')).toContainText(vnd(year.orders.revenueVnd));
    await expect(page.getByRole('heading', { name: 'Doanh thu theo tháng' })).toBeVisible();
  });

  test('admin creates a user, changes the role and locks it; the user can no longer log in', async ({ page }) => {
    const email = `ui-${uniq()}@e2e.test`;
    const password = 'Matkhau@123';

    await page.goto('/admin/users');
    await page.getByRole('button', { name: '+ Tạo tài khoản' }).click();
    const create = page.getByRole('dialog', { name: 'Tạo tài khoản' });
    await create.getByLabel('Họ và tên').fill('Học viên tạo qua giao diện');
    await create.getByLabel('Email').fill(email);
    await create.getByLabel('Mật khẩu').fill(password);
    await create.getByLabel('Vai trò').selectOption('STUDENT');
    await create.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(page.getByText(`Đã tạo tài khoản ${email}`)).toBeVisible();

    const login = async () => (await anonymousApi()).post('auth/login', { data: { email, password } });
    expect((await login()).ok()).toBeTruthy();

    await page.getByRole('searchbox', { name: 'Tìm người dùng' }).fill(email);
    const row = page.getByTestId(`user-row-${email}`);
    await expect(row.getByText('Học viên', { exact: true })).toBeVisible();

    await row.getByRole('button', { name: `Thao tác với ${email}` }).click();
    await page.getByRole('menuitem', { name: 'Đổi vai trò…' }).click();
    const roleDialog = page.getByRole('dialog');
    await roleDialog.getByLabel('Vai trò').selectOption('TEACHER');
    await roleDialog.getByRole('button', { name: 'Đổi vai trò' }).click();
    await expect(row.getByText('Giáo viên', { exact: true })).toBeVisible();
    await expect(row.getByText('0 khoá phụ trách')).toBeVisible();

    await row.getByRole('button', { name: `Thao tác với ${email}` }).click();
    await page.getByRole('menuitem', { name: 'Khoá tài khoản' }).click();
    await page.getByRole('dialog', { name: `Khoá tài khoản ${email}?` }).getByRole('button', { name: 'Khoá tài khoản' }).click();
    await expect(row.getByText('Đã khoá')).toBeVisible();

    const denied = await login();
    expect(denied.status()).toBe(401);
    expect((await denied.json()).message).toBe('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');

    // The filter finds it under "Đã khoá", and unlocking restores the login.
    await page.getByLabel('Trạng thái').selectOption('locked');
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: `Thao tác với ${email}` }).click();
    await page.getByRole('menuitem', { name: 'Mở khoá tài khoản' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Mở khoá' }).click();
    await expect(page.getByText(`Đã mở khoá ${email}`)).toBeVisible();
    expect((await login()).ok()).toBeTruthy();
  });

  test('admin deletes a user only after typing the email again', async ({ page }) => {
    const admin = await apiAs('admin');
    const email = `xoa-${uniq()}@e2e.test`;
    const created = await admin.post('users', {
      data: { email, password: 'Matkhau@123', fullName: 'Tài khoản sẽ bị xoá', role: 'STUDENT' },
    });
    expect(created.status(), await created.text()).toBe(201);

    await page.goto('/admin/users');
    await page.getByRole('searchbox', { name: 'Tìm người dùng' }).fill(email);
    const row = page.getByTestId(`user-row-${email}`);
    await row.getByRole('button', { name: `Thao tác với ${email}` }).click();
    await page.getByRole('menuitem', { name: 'Xoá tài khoản…' }).click();
    const dialog = page.getByRole('dialog');
    const confirm = dialog.getByRole('button', { name: 'Xoá vĩnh viễn' });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(`Gõ lại ${email} để xác nhận`).fill(email);
    await confirm.click();
    await expect(page.getByText(`Đã xoá tài khoản ${email}`)).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test('admin sets a price and hides a course on the courses page', async ({ page }) => {
    const teacher = await apiAs('teacher');
    const { courseId } = await createPaidCourse(teacher);
    const title = (await (await teacher.get(`courses/${courseId}`)).json()).title as string;

    await page.goto('/admin/courses');
    await page.getByRole('searchbox', { name: 'Tìm khoá học' }).fill(title);
    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row.getByText('Chưa đặt')).toBeVisible();
    await expect(row.getByText('Chưa mở bán')).toBeVisible();

    await row.getByRole('button', { name: title }).click();
    const editor = page.getByRole('complementary', { name: title });
    await editor.getByLabel('Giá bán (₫)').fill('500');
    await expect(editor.getByText('Giá từ 1.000 ₫ đến 100.000.000 ₫, số nguyên.')).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Lưu' })).toBeDisabled();
    await editor.getByLabel('Giá bán (₫)').fill('345000');
    await editor.getByRole('button', { name: 'Lưu' }).click();
    await expect(row.getByText(vnd(345000))).toBeVisible();
    await expect(row.getByText('Đang bán')).toBeVisible();
    expect((await (await teacher.get(`courses/${courseId}`)).json()).priceVnd).toBe(345000);

    await editor.getByLabel('Hiển thị trên trang khoá học').uncheck();
    await editor.getByRole('button', { name: 'Lưu' }).click();
    await expect(row.getByText('Bản nháp')).toBeVisible();
    expect((await (await teacher.get(`courses/${courseId}`)).json()).isPublished).toBe(false);
  });
});

test.describe('admin area as a teacher', () => {
  test.use({ storageState: storageStateFor('teacher') });

  test('a teacher sees the admin-only notice on the new pages', async ({ page }) => {
    for (const path of ['/admin/users', '/admin/courses']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: /chỉ dành cho Quản trị viên/ })).toBeVisible();
    }
  });
});
