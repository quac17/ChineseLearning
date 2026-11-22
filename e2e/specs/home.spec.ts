import { expect, test } from '@playwright/test';
import { SEED, storageStateFor } from '../fixtures/auth';
import { newStudent } from '../fixtures/payments';

test.describe('home page', () => {
  test('hero, program tabs with real courses and prices, photo credits', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Học tiếng Trung theo cách của bạn' })).toBeVisible();

    const programs = page.getByRole('tabpanel');
    await expect(page.getByRole('tab', { name: 'HSK' })).toHaveAttribute('aria-selected', 'true');
    const hsk1 = programs.getByRole('link', { name: /HSK 1/ });
    await expect(hsk1).toContainText('499.000 ₫');

    await page.getByRole('tab', { name: 'YCT' }).click();
    await expect(programs.getByRole('link', { name: /YCT 1/ })).toBeVisible();
    await expect(programs.getByRole('link', { name: /HSK 1/ })).toHaveCount(0);

    await programs.getByRole('link', { name: /YCT 1/ }).click();
    await expect(page).toHaveURL(/\/courses\/course-yct1$/);

    // Stock photos on the home page carry their credit line; other pages do not.
    await page.goto('/');
    await expect(page.getByText(/Ảnh qua Wikimedia Commons/)).toBeVisible();
    await page.goto('/courses');
    await expect(page.getByText(/Ảnh qua Wikimedia Commons/)).toHaveCount(0);
  });

  test('goal tiles open the catalog filtered by program', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Cho con học YCT/ }).click();
    await expect(page).toHaveURL(/\/courses\?program=yct/);
  });
});

test.describe('footer and auth pages', () => {
  test('footer shows account links when logged in, login links when not', async ({ page }) => {
    await page.goto('/courses');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();

    await newStudent(page.request);
    await page.reload();
    await expect(footer.getByRole('link', { name: 'Khoá học của tôi' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Đăng nhập' })).toHaveCount(0);
  });

  test('register from a course page comes back to it', async ({ page }) => {
    await page.goto(`/register?next=%2Fcourses%2F${SEED.hsk1}`);
    await page.getByLabel('Họ và tên').fill('Học viên quay lại');
    await page.getByLabel('Email').fill(`quaylai-${Date.now()}@e2e.test`);
    await page.getByLabel(/Mật khẩu/).fill('Matkhau@123');
    await page.getByRole('checkbox', { name: /Tôi đồng ý với Điều khoản sử dụng/ }).check();
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${SEED.hsk1}$`));
  });

  test('a short password is flagged before submitting', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/Mật khẩu/).fill('123');
    await expect(page.getByText('Mật khẩu cần ít nhất 6 ký tự.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo tài khoản' })).toBeDisabled();
  });

  test.describe('as studentA', () => {
    test.use({ storageState: storageStateFor('studentA') });
    test('the login page says you are already logged in', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Bạn đã đăng nhập' })).toBeVisible();
    });
  });
});
