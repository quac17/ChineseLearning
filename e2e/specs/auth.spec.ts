import { expect, test } from '@playwright/test';
import { ACCOUNTS, expectLoggedInAs, loginThroughForm } from '../fixtures/auth';
import { uniq } from '../fixtures/data';

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

test('register a new student account', async ({ page }) => {
  const email = `hocvien-${uniq()}@e2e.test`;
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Học viên E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/Mật khẩu/).fill('Matkhau@123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

  await expect(page).toHaveURL(/\/courses$/);
  await expectLoggedInAs(page, 'Học viên E2E');
});
