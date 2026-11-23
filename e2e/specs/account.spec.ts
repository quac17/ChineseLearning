import { expect, test } from '@playwright/test';
import { newStudent } from '../fixtures/payments';

// Account page (AppAccount board on phones, WebProfile on desktop) and the theme choice.

const html = (page: import('@playwright/test').Page) => page.locator('html');

test.describe('account on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('settings list opens one section at a time and goes back', async ({ page }) => {
    const { email } = await newStudent(page.request);
    await page.goto('/account');

    await expect(page.getByText(email)).toBeVisible();
    for (const row of ['Hồ sơ và mục tiêu học', 'Đơn hàng', 'Đổi mật khẩu', 'Giao diện']) {
      await expect(page.getByRole('link', { name: new RegExp(`^${row}`) })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
    // NEXT_PUBLIC_SUPPORT_CONTACT is empty in the e2e stack, so "Hỗ trợ" is hidden.
    await expect(page.getByRole('link', { name: /^Hỗ trợ/ })).toHaveCount(0);
    // Side nav and sections stay hidden behind the list.
    await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeHidden();

    await page.getByRole('link', { name: /^Đổi mật khẩu/ }).click();
    await expect(page).toHaveURL(/#bao-mat$/);
    await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();
    await expect(page.getByLabel('Mật khẩu hiện tại')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hồ sơ' })).toBeHidden();
    await expect(page.getByRole('link', { name: /^Đơn hàng/ })).toBeHidden();

    await page.getByRole('main').getByRole('button', { name: 'Tài khoản', exact: true }).click();
    await expect(page.getByRole('link', { name: /^Đơn hàng/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeHidden();

    // The browser back button also returns to the list.
    await page.getByRole('link', { name: /^Đơn hàng/ }).click();
    await expect(page.getByText('Bạn chưa có đơn hàng nào.')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('link', { name: /^Hồ sơ và mục tiêu học/ })).toBeVisible();

    // A direct link opens the section.
    await page.goto('/account#ho-so');
    await expect(page.getByLabel('Họ và tên')).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('log out from the list', async ({ page }) => {
    await newStudent(page.request);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Bạn chưa đăng nhập' })).toBeVisible();
  });
});

test.describe('theme: Sáng / Tối / Theo máy', () => {
  test('"Theo máy" is the default and follows the device, also live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await newStudent(page.request);
    await page.goto('/account');
    await expect(page.getByRole('radio', { name: 'Theo máy' })).toBeChecked();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
  });

  test('a fixed choice wins over the device, survives a reload, and can go back to "Theo máy"', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await newStudent(page.request);
    await page.goto('/account');

    await page.getByRole('radio', { name: 'Tối' }).check();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('chinese_learner_theme'))).toBe('dark');

    // Set before paint by the inline script: already dark when the HTML is parsed.
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await html(page).getAttribute('data-theme')).toBe('dark');
    await expect(page.getByRole('radio', { name: 'Tối' })).toBeChecked();

    await page.getByRole('radio', { name: 'Theo máy' }).check();
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => localStorage.getItem('chinese_learner_theme'))).toBeNull();
  });

  test('the header button still switches and pins the theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await newStudent(page.request);
    await page.goto('/account');
    await expect(page.getByRole('radio', { name: 'Theo máy' })).toBeChecked();

    await page.getByRole('button', { name: 'Chuyển sang giao diện tối' }).click();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('radio', { name: 'Tối' })).toBeChecked();

    await page.getByRole('button', { name: 'Chuyển sang giao diện sáng' }).click();
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('radio', { name: 'Sáng' })).toBeChecked();
  });

  test('on desktop every section shows, the phone list does not', async ({ page }) => {
    await newStudent(page.request);
    await page.goto('/account');
    for (const h of ['Hồ sơ', 'Đổi mật khẩu', 'Đơn hàng', 'Giao diện']) {
      await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /^Hồ sơ và mục tiêu học/ })).toBeHidden();
  });
});
