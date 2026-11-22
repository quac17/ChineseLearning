import { expect, test } from '@playwright/test';
import { SEED, storageStateFor } from '../fixtures/auth';

// Shared states from docs/design/canvas/States.dc.html.

test('an unknown URL shows the 404 with ways back', async ({ page }) => {
  const res = await page.goto('/khong-co-trang-nay');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Lạc đường rồi' })).toBeVisible();
  await expect(page.getByText('迷路')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('main').getByRole('link', { name: 'Xem khoá học' })).toHaveAttribute('href', '/courses');
});

test('a server failure shows the error state and "Thử lại" recovers', async ({ page }) => {
  let fail = true;
  await page.route(`**/api/courses/${SEED.hsk1}`, (route) =>
    fail ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }) : route.fallback(),
  );
  await page.goto(`/courses/${SEED.hsk1}`);
  await expect(page.getByRole('heading', { name: 'Không tải được nội dung' })).toBeVisible();

  fail = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /HSK 1/ })).toBeVisible();
});

test.describe('offline', () => {
  test.use({ storageState: storageStateFor('studentB') });

  test('the offline bar appears, network buttons grey out, and both recover', async ({ page, context }) => {
    await page.goto(`/courses/${SEED.hsk1}`);
    const buy = page
      .getByRole('complementary', { name: 'Mở khoá khoá học' })
      .getByRole('button', { name: 'Mua ngay bằng QR' });
    await expect(buy).toBeEnabled();

    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Bạn đang ngoại tuyến' })).toBeVisible();
    await expect(buy).toBeDisabled();

    await context.setOffline(false);
    await expect(page.getByText('Bạn đang ngoại tuyến')).toBeHidden();
    await expect(buy).toBeEnabled();
  });
});

test('logged out, the teacher area asks to log in and comes back', async ({ page }) => {
  await page.goto('/teacher');
  await expect(page.getByRole('heading', { name: 'Đăng nhập để vào trang này' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
    'href',
    '/login?next=%2Fteacher',
  );
});
