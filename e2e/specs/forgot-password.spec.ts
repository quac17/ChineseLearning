import { expect, test } from '@playwright/test';
import { API_URL, WEB_URL } from '../env';
import { anonymousApi, expectLoggedInAs, loginThroughForm } from '../fixtures/auth';
import { uniq } from '../fixtures/data';
import { linkIn, mailsTo } from '../fixtures/mail';

// Forgot password by email (#31), with the console mailer standing in for SMTP.

const SUBJECT = 'Đặt lại mật khẩu Chinese Learner';
const ANSWER = 'Nếu email này có tài khoản, chúng tôi đã gửi đường dẫn đặt lại mật khẩu. Hãy kiểm tra hộp thư, cả thư mục Spam.';

async function newAccount(password = 'Matkhau@123') {
  const api = await anonymousApi();
  const email = `quen-${uniq()}@e2e.test`;
  const res = await api.post(`${API_URL}/auth/register`, {
    data: { fullName: 'Học viên quên mật khẩu', email, password, acceptTerms: true },
  });
  expect(res.status(), await res.text()).toBe(201);
  return { api, email, password, fullName: 'Học viên quên mật khẩu' };
}

test('forgot password: mail, set a new one, log in with it', async ({ page }) => {
  const { api, email, password, fullName } = await newAccount();
  // Tokens carry whole-second timestamps and one second of skew is allowed:
  // let the clock pass a second boundary so the register cookie is "before" the reset.
  await new Promise((r) => setTimeout(r, 1100));

  await page.goto('/login');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Gửi đường dẫn' }).click();

  await expect(page.getByRole('heading', { name: 'Kiểm tra hộp thư' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  const [mail] = await mailsTo(api, email, SUBJECT);
  const link = linkIn(mail, `${WEB_URL}/reset-password#token=`);

  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible();
  // The token leaves the address bar once it has been read.
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('MatkhauMoi@456');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('MatkhauMoi@456');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await expect(page.getByRole('heading', { name: 'Đã đặt lại mật khẩu' })).toBeVisible();

  // Sessions from before the reset (an attacker's, say) are logged out.
  expect((await api.get(`${API_URL}/auth/me`)).status()).toBe(401);

  // The old password stops working, the new one logs in.
  await loginThroughForm(page, email, password);
  await expect(page.getByText('Email hoặc mật khẩu không đúng.')).toBeVisible();
  await loginThroughForm(page, email, 'MatkhauMoi@456');
  await expectLoggedInAs(page, fullName);

  // The same link works only once.
  await page.goto(link);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('LanThuBa@789');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('LanThuBa@789');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await expect(page.getByText('Đường dẫn này đã được dùng.', { exact: false })).toBeVisible();
});

test('changing the password keeps this session and logs out the others', async () => {
  const { api: other, email, password } = await newAccount();
  const here = await anonymousApi();
  expect((await here.post(`${API_URL}/auth/login`, { data: { email, password } })).status()).toBe(201);
  // Tokens carry whole-second timestamps and one second of skew is allowed,
  // so let the clock pass a second boundary before the change.
  await new Promise((r) => setTimeout(r, 1100));

  const res = await here.patch(`${API_URL}/auth/password`, { data: { currentPassword: password, newPassword: 'MatkhauMoi@456' } });
  expect(res.status(), await res.text()).toBe(200);
  expect((await here.get(`${API_URL}/auth/me`)).status()).toBe(200);
  const stale = await other.get(`${API_URL}/auth/me`);
  expect(stale.status()).toBe(401);
  expect((await stale.json()).message).toBe('Mật khẩu đã được đổi. Vui lòng đăng nhập lại.');
});

test('same answer for an unknown email, and no mail is sent', async () => {
  const api = await anonymousApi();
  const email = `khong-co-${uniq()}@e2e.test`;
  const res = await api.post(`${API_URL}/auth/forgot-password`, { data: { email } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ message: ANSWER });
  expect(await mailsTo(api, email)).toHaveLength(0);
});

test('a new reset closes older links; at most 3 links per hour per account', async () => {
  const { api, email } = await newAccount();
  for (let i = 0; i < 4; i += 1) {
    const res = await api.post(`${API_URL}/auth/forgot-password`, { data: { email } });
    expect(await res.json()).toEqual({ message: ANSWER });
  }
  const mails = await mailsTo(api, email, SUBJECT);
  expect(mails).toHaveLength(3);

  const token = (m: (typeof mails)[number]) => decodeURIComponent(linkIn(m, `${WEB_URL}/reset-password#token=`).split('#token=')[1]);
  const [newest, , oldest] = mails;
  const ok = await api.post(`${API_URL}/auth/reset-password`, { data: { token: token(newest), password: 'MatkhauMoi@456' } });
  expect(ok.status(), await ok.text()).toBe(200);

  const stale = await api.post(`${API_URL}/auth/reset-password`, { data: { token: token(oldest), password: 'KhacNua@789' } });
  expect(stale.status()).toBe(400);
  expect((await stale.json()).message).toContain('đã được dùng');
});

test('a link with no or a wrong token offers a new one', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByRole('heading', { name: 'Đường dẫn không hợp lệ' })).toBeVisible();
  await page.getByRole('link', { name: 'Yêu cầu đường dẫn mới' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);

  await page.goto('/reset-password#token=khong-phai-token-that-0123456789');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('MatkhauMoi@456');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('MatkhauMoi@456');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await expect(page.getByText('Đường dẫn đặt lại mật khẩu không hợp lệ.', { exact: false })).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('"Quên mật khẩu?" sits under the password field and the page fits', async ({ page }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: 'Quên mật khẩu?' });
    await expect(link).toBeVisible();
    const field = await page.getByLabel('Mật khẩu').boundingBox();
    const box = await link.boundingBox();
    expect(box!.y).toBeGreaterThan(field!.y + field!.height - 1);
    await link.click();
    await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
