import { expect, test } from '@playwright/test';

const PAGES = [
  { path: '/dieu-khoan', title: 'Điều khoản sử dụng', section: '3. Sử dụng nội dung' },
  { path: '/bao-mat', title: 'Chính sách bảo mật', section: '4. Cookie và lưu trữ trên thiết bị' },
] as const;

test.describe('legal pages', () => {
  for (const p of PAGES) {
    test(`${p.path} renders the draft and is linked from the footer`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('contentinfo').getByRole('link', { name: p.title }).click();
      await expect(page).toHaveURL(new RegExp(`${p.path}$`));
      await expect(page).toHaveTitle(new RegExp(p.title));

      await expect(page.getByRole('heading', { level: 1, name: p.title })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: p.section })).toBeVisible();
      // Shown while the content file says `draft: true` (until the owner approves, #15).
      await expect(page.getByText('Bản nháp — đang chờ chủ dự án duyệt.')).toBeVisible();
      // Unfilled placeholders are highlighted, never presented as real facts.
      await expect(page.locator('mark', { hasText: '[Tên đơn vị vận hành]' }).first()).toBeVisible();
    });
  }

  test('the table of contents jumps to a section, and the pages link to each other', async ({ page }) => {
    await page.goto('/bao-mat');
    await page.getByRole('navigation', { name: 'Mục lục' }).getByRole('link', { name: 'Cookie và lưu trữ trên thiết bị' }).click();
    await expect(page).toHaveURL(/#4-cookie-va-luu-tru-tren-thiet-bi$/);

    await page.getByRole('navigation', { name: 'Văn bản pháp lý' }).getByRole('link', { name: 'Điều khoản sử dụng' }).click();
    await expect(page).toHaveURL(/\/dieu-khoan$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Điều khoản sử dụng' })).toBeVisible();
  });

  test('readable on a 375px phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const p of PAGES) {
      await page.goto(p.path);
      await expect(page.getByRole('heading', { level: 1, name: p.title })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});
