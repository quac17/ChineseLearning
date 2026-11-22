import { expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { SEED, apiAs, storageStateFor } from '../fixtures/auth';
import { createPaidCourse, setAccess } from '../fixtures/data';
import { checkout, newStudent, orderCodeOf, postWebhook, signedWebhook } from '../fixtures/payments';

// Seed prices: course-hsk1 499.000 ₫, course-yct1 399.000 ₫, course-talk1 not on sale.
// Every purchase uses a fresh student so other specs keep their seed contract.

const YCT1 = 'course-yct1';

async function canWatchAll(api: Awaited<ReturnType<typeof request.newContext>>, courseId: string) {
  const course = await (await api.get(`${API_URL}/courses/${courseId}`)).json();
  return course.hasAccess as boolean;
}

test.describe('checkout API and webhook', () => {
  test('pay by webhook: idempotent, amount-checked, signature-checked', async () => {
    const api = await request.newContext();
    await newStudent(api);

    // Guard rails before buying.
    expect((await checkout(api, 'course-easy1')).status()).toBe(400); // free
    expect((await checkout(api, 'course-talk1')).status()).toBe(400); // not on sale

    const res = await checkout(api, YCT1);
    expect(res.status(), await res.text()).toBe(201);
    const order = await res.json();
    expect(order).toMatchObject({ status: 'PENDING', amountVnd: 399000, courseId: YCT1, canSimulate: true });
    expect(order.code).toMatch(/^VK-\d+$/);
    expect(order.qrCode).toBeTruthy();
    const code = orderCodeOf(order);

    // A still-valid pending order is reused, not duplicated.
    expect((await (await checkout(api, YCT1)).json()).id).toBe(order.id);

    // Bad signature → 400, nothing changes.
    const forged = signedWebhook(code, 399000, 'E2E-FORGED');
    expect((await postWebhook(api, { ...forged, data: { ...forged.data, amount: 1 } })).status()).toBe(400);

    // Too little money → acknowledged, not granted, flagged for review.
    const short = await postWebhook(api, signedWebhook(code, 1000, `E2E-SHORT-${code}`));
    expect(await short.json()).toMatchObject({ outcome: 'AMOUNT_MISMATCH' });
    expect(await canWatchAll(api, YCT1)).toBe(false);

    // A failed transfer notice is acknowledged and ignored.
    expect(await (await postWebhook(api, signedWebhook(code, 399000, `E2E-FAIL-${code}`, '01'))).json()).toMatchObject({
      outcome: 'NOT_PAID',
    });

    // The real payment opens the course.
    const paid = signedWebhook(code, 399000, `E2E-OK-${code}`);
    expect(await (await postWebhook(api, paid)).json()).toMatchObject({ outcome: 'GRANTED' });
    expect(await canWatchAll(api, YCT1)).toBe(true);
    expect((await (await api.get(`${API_URL}/payments/orders/${order.id}`)).json()).status).toBe('PAID');

    // Retries and late duplicates are no-ops.
    expect(await (await postWebhook(api, paid)).json()).toMatchObject({ outcome: 'DUPLICATE' });
    expect(await (await postWebhook(api, signedWebhook(code, 399000, `E2E-LATE-${code}`))).json()).toMatchObject({
      outcome: 'ALREADY_PAID',
    });

    // Already owned → cannot buy again.
    expect((await checkout(api, YCT1)).status()).toBe(400);

    // Unknown order (like PayOS's test webhook when registering the URL) → 200.
    expect((await postWebhook(api, signedWebhook(123, 3000, `E2E-UNKNOWN-${code}`))).status()).toBe(200);

    // Another learner cannot read this order.
    const other = await request.newContext();
    await newStudent(other);
    expect((await other.get(`${API_URL}/payments/orders/${order.id}`)).status()).toBe(404);

    // Admin sees the history and can record a refund, which closes access.
    const admin = await apiAs('admin');
    const detail = await (await admin.get(`payments/admin/orders/${order.id}`)).json();
    expect(detail.events.map((e: { outcome: string }) => e.outcome)).toEqual(
      expect.arrayContaining(['OK', 'AMOUNT_MISMATCH', 'GRANTED', 'ALREADY_PAID']),
    );
    const refund = await admin.post(`payments/admin/orders/${order.id}/refund`, { data: { note: 'e2e' } });
    expect(refund.status(), await refund.text()).toBe(200);
    expect(await canWatchAll(api, YCT1)).toBe(false);
    expect((await admin.post(`payments/admin/orders/${order.id}/grant`, { data: {} })).status()).toBe(400);
  });

  test('a purchase re-opens a revoked enrollment', async () => {
    const api = await request.newContext();
    const student = await newStudent(api);
    const teacher = await apiAs('teacher');
    await setAccess(teacher, YCT1, student.id, true);
    await setAccess(teacher, YCT1, student.id, false);
    expect(await canWatchAll(api, YCT1)).toBe(false);

    const order = await (await checkout(api, YCT1)).json();
    await postWebhook(api, signedWebhook(orderCodeOf(order), 399000, `E2E-REVOKED-${order.id}`));
    expect(await canWatchAll(api, YCT1)).toBe(true);
  });

  test('only admins set prices; teachers and students cannot', async () => {
    const teacher = await apiAs('teacher');
    const { courseId } = await createPaidCourse(teacher);
    expect((await teacher.patch(`courses/${courseId}/price`, { data: { priceVnd: 1000 } })).status()).toBe(403);
    expect(
      (await (await apiAs('studentA')).patch(`courses/${courseId}/price`, { data: { priceVnd: 1000 } })).status(),
    ).toBe(403);
    const admin = await apiAs('admin');
    expect((await admin.patch(`courses/${courseId}/price`, { data: { priceVnd: 500 } })).status()).toBe(400);
    expect((await admin.patch(`courses/${courseId}/price`, { data: { priceVnd: 2000 } })).ok()).toBeTruthy();
    expect((await (await admin.get(`courses/${courseId}`)).json()).priceVnd).toBe(2000);
  });
});

test.describe('checkout in the browser', () => {
  test('buy HSK 1 with the QR page, then learn the paid lesson', async ({ page }) => {
    await newStudent(page.request); // logs the page in too (shared cookies)

    await page.goto(`/courses/${SEED.hsk1}`);
    const buyBox = page.getByRole('complementary', { name: 'Mở khoá khoá học' });
    await expect(buyBox.getByText('499.000 ₫')).toBeVisible();
    await buyBox.getByRole('button', { name: 'Mua ngay bằng QR' }).click();

    await expect(page).toHaveURL(/\/checkout\/order-/);
    await expect(page.getByRole('heading', { name: 'Thanh toán khoá học' })).toBeVisible();
    await expect(page.getByRole('img', { name: /Mã VietQR thanh toán 499\.000 ₫/ })).toBeVisible();

    await page.getByRole('button', { name: 'Giả lập: đã thanh toán' }).click();
    await expect(page.getByRole('heading', { name: 'Thanh toán thành công' })).toBeVisible();

    await page.getByRole('link', { name: 'Vào học ngay' }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${SEED.hsk1}/`));
    await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1PaidLesson}`);
    await expect(page.locator('iframe')).toBeVisible();

    await page.goto('/account');
    const orders = page.getByRole('region', { name: 'Đơn hàng' });
    await expect(orders.getByText('Đã thanh toán')).toBeVisible();
  });

  test('logged out: buying asks to log in first and comes back', async ({ page }) => {
    await page.goto(`/courses/${SEED.hsk1}`);
    await page.getByRole('link', { name: 'Mua ngay bằng QR' }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fcourses%2Fcourse-hsk1/);
  });

  test.describe('as admin', () => {
    test.use({ storageState: storageStateFor('admin') });

    test('sets a price on the prices page and finds an order on the orders page', async ({ page }) => {
      const teacher = await apiAs('teacher');
      const { courseId } = await createPaidCourse(teacher);
      const title = (await (await teacher.get(`courses/${courseId}`)).json()).title as string;

      await page.goto('/admin/prices');
      const row = page.getByRole('row', { name: new RegExp(title) });
      await row.getByLabel(/Giá của/).fill('250000');
      await row.getByRole('button', { name: 'Lưu' }).click();
      await expect(row.getByText('Đang bán')).toBeVisible();

      // Buy it as a fresh student, then look the order up.
      const api = await request.newContext();
      await newStudent(api);
      const order = await (await checkout(api, courseId)).json();
      expect(order.amountVnd).toBe(250000);

      await page.goto('/admin/orders');
      await page.getByRole('searchbox', { name: 'Tìm đơn' }).fill(order.code);
      await page.getByRole('button', { name: order.code }).click();
      await expect(page.getByRole('heading', { name: `Đơn ${order.code}` })).toBeVisible();
      await expect(page.getByText('Tạo đơn, sinh mã QR')).toBeVisible();
    });
  });
});
