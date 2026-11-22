import { expect, test } from '@playwright/test';
import { ACCOUNTS, expectLoggedInAs, loginThroughForm } from '../fixtures/auth';
import { uniq } from '../fixtures/data';
import { API_URL } from '../env';

test.describe('login form', () => {
  const landing = [
    ['admin', '/admin'],
    ['teacher', '/teacher'],
    ['studentA', '/courses'],
  ] as const;

  for (const [role, path] of landing) {
    test(`${role} lands on ${path}`, async ({ page }) => {
      const { email, password } = ACCOUNTS[role];
      await loginThroughForm(page, email, password);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }

  test('wrong password shows an error and stays on /login', async ({ page }) => {
    await loginThroughForm(page, ACCOUNTS.studentB.email, 'sai-mat-khau');
    await expect(page.getByText('Email hoặc mật khẩu không đúng.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('session survives a reload, logout ends it', async ({ page }) => {
    const { email, password, fullName } = ACCOUNTS.studentB;
    await loginThroughForm(page, email, password);
    await expect(page).toHaveURL(/\/courses$/);
    await expectLoggedInAs(page, fullName);

    await page.reload();
    await expectLoggedInAs(page, fullName);

    await page.getByRole('button', { name: `Tài khoản của ${fullName}` }).click();
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
    // The footer always has a "Đăng nhập" link, so wait for the account button to go instead.
    await expect(page.getByRole('button', { name: `Tài khoản của ${fullName}` })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('button', { name: `Tài khoản của ${fullName}` })).toHaveCount(0);
  });
});

test('register needs the consent box, then stores when it was ticked', async ({ page }) => {
  const email = `hocvien-${uniq()}@e2e.test`;
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Học viên E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/Mật khẩu/).fill('Matkhau@123');

  const submit = page.getByRole('button', { name: 'Tạo tài khoản' });
  const consent = page.getByRole('checkbox', { name: /Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật/ });
  await expect(consent).not.toBeChecked();
  await expect(submit).toBeDisabled();

  await consent.check();
  await expect(submit).toBeEnabled();
  const registered = page.waitForResponse((r) => r.url().endsWith('/auth/register') && r.request().method() === 'POST');
  await submit.click();

  const res = await registered;
  expect(res.status()).toBe(201);
  const { user } = await res.json();
  expect(Date.parse(user.termsAcceptedAt)).toBeGreaterThan(Date.now() - 5 * 60_000);

  await expect(page).toHaveURL(/\/courses$/);
  await expectLoggedInAs(page, 'Học viên E2E');
  // Logging in again returns the same stored consent time.
  const me = await page.request.get(`${API_URL}/auth/me`);
  expect((await me.json()).user.termsAcceptedAt).toBe(user.termsAcceptedAt);
});

test('the consent links open the legal pages in a new tab and keep the typed values', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Học viên đọc điều khoản');
  const [terms] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: 'Điều khoản sử dụng' }).first().click(),
  ]);
  await expect(terms).toHaveURL(/\/dieu-khoan$/);
  await expect(terms.getByRole('heading', { level: 1, name: 'Điều khoản sử dụng' })).toBeVisible();
  await terms.close();
  await expect(page.getByLabel('Họ và tên')).toHaveValue('Học viên đọc điều khoản');
});

test('the API refuses a register without consent, in Vietnamese', async ({ request }) => {
  const body = { fullName: 'Học viên chưa đồng ý', email: `chuadongy-${uniq()}@e2e.test`, password: 'Matkhau@123' };
  for (const data of [body, { ...body, acceptTerms: false }]) {
    const res = await request.post(`${API_URL}/auth/register`, { data });
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật');
  }
  // Nothing was created: the same email can still register once it consents.
  const ok = await request.post(`${API_URL}/auth/register`, { data: { ...body, acceptTerms: true } });
  expect(ok.status(), await ok.text()).toBe(201);
});
