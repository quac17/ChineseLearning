import { expect, test, type Page } from '@playwright/test';
import { API_URL } from '../env';
import { checkout, newStudent } from '../fixtures/payments';

// AppCheckout board: on a phone nobody can scan the QR on their own screen, so
// "Mở app ngân hàng" (PayOS checkoutUrl, which lists the bank apps) comes first.
// The fake gateway has no hosted page, so the PayOS link is injected into the
// order response here; everything else is the real e2e stack.

const PHONE = { width: 375, height: 812 };
const PAYOS_PAGE = 'https://pay.payos.vn/web/e2e-link';

async function withPayosLink(page: Page) {
  await page.route(`${API_URL}/payments/orders/*`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch();
    const order = await res.json();
    await route.fulfill({ response: res, json: { ...order, checkoutUrl: PAYOS_PAGE } });
  });
}

async function openNewOrder(page: Page) {
  await newStudent(page.request);
  const order = await (await checkout(page.request, 'course-yct1')).json();
  await page.goto(`/checkout/${order.id}`);
  await expect(page.getByRole('heading', { name: 'Thanh toán khoá học' })).toBeVisible();
  return order as { id: string; code: string };
}

test.describe('checkout at phone width', () => {
  test.use({ viewport: PHONE });

  test('"Mở app ngân hàng" is the first action, on screen, then "Lưu mã QR"', async ({ page }) => {
    await withPayosLink(page);
    await openNewOrder(page);

    const actions = page.getByTestId('mobile-pay-actions');
    const bank = actions.getByRole('link', { name: 'Mở app ngân hàng' });
    await expect(bank).toBeInViewport();
    await expect(bank).toHaveAttribute('href', PAYOS_PAGE);
    await expect(actions.getByRole('link', { name: 'Lưu mã QR' })).toBeInViewport();

    // First button-like control on the page, and the desktop link is not shown.
    const firstAction = page.locator('main').getByRole('link', { name: /Mở app ngân hàng|Lưu mã QR|PayOS/ }).first();
    await expect(firstAction).toHaveText('Mở app ngân hàng');
    await expect(page.getByRole('link', { name: 'Mở trang thanh toán PayOS' })).toBeHidden();

    await expect(page.getByRole('status').filter({ hasText: 'Đang chờ xác nhận' })).toBeInViewport();
  });

  test('without a PayOS page, "Lưu mã QR" is the action and the fake payment still opens the course', async ({ page }) => {
    await openNewOrder(page);
    const actions = page.getByTestId('mobile-pay-actions');
    await expect(actions.getByRole('link', { name: 'Mở app ngân hàng' })).toHaveCount(0);
    await expect(actions.getByRole('link', { name: 'Lưu mã QR' })).toBeInViewport();

    await page.getByRole('button', { name: 'Giả lập: đã thanh toán' }).click();
    await expect(page.getByRole('heading', { name: 'Thanh toán thành công' })).toBeVisible();
    await expect(page.getByTestId('mobile-pay-actions')).toHaveCount(0);
  });
});

test('desktop keeps the side-by-side QR with the PayOS link', async ({ page }) => {
  await withPayosLink(page);
  await openNewOrder(page);
  await expect(page.getByRole('link', { name: 'Mở trang thanh toán PayOS' })).toBeVisible();
  await expect(page.getByTestId('mobile-pay-actions')).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Đang chờ xác nhận' })).toBeVisible();
});
