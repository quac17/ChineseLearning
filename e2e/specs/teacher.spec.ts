import { expect, test } from '@playwright/test';
import { anonymousApi, apiAs, storageStateFor } from '../fixtures/auth';
import { uniq } from '../fixtures/data';

// The teacher area (/teacher). Other specs create courses for the seed
// teacher in parallel, so every check looks up its own course by a unique title.

test.describe('teacher area', () => {
  test.use({ storageState: storageStateFor('teacher') });

  test('overview counts courses and lessons, never revenue', async ({ page }) => {
    await page.goto('/teacher');
    await expect(page.getByRole('heading', { level: 1, name: /Xin chào/ })).toBeVisible();
    await expect(page.getByText('Khoá đã xuất bản')).toBeVisible();
    await expect(page.getByText('Học viên có quyền xem')).toBeVisible();
    await expect(page.getByText(/doanh thu/i)).toHaveText(/không hiển thị doanh thu/);
    await expect(page.getByRole('navigation', { name: 'Khu giáo viên' }).getByRole('link', { name: 'Tổng quan' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('creates a draft course, then publishes it from the list', async ({ page }) => {
    const title = `E2E khoá giao diện ${uniq()}`;
    await page.goto('/teacher/courses');
    await page.getByRole('button', { name: '+ Tạo khoá học' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tạo khoá học' });
    await dialog.getByLabel('Tên khoá học').fill(title);
    await dialog.getByLabel('Chương trình').selectOption('yct');
    await dialog.getByRole('button', { name: 'Tạo bản nháp' }).click();
    await expect(page.getByText(`Đã tạo bản nháp "${title}"`)).toBeVisible();

    await page.getByLabel('Tìm khoá học').fill(title);
    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row).toHaveCount(1);
    await expect(row.getByText('Bản nháp')).toBeVisible();
    await expect(row.getByText('YCT', { exact: true })).toBeVisible();

    // A draft is not in the public catalog.
    const anon = await anonymousApi();
    const catalog = await (await anon.get(`courses?q=${encodeURIComponent(title)}`)).json();
    expect(catalog).toHaveLength(0);

    await row.getByRole('button', { name: `Xuất bản "${title}"` }).click();
    await expect(row.getByText('Đã xuất bản')).toBeVisible();
    const published = await (await anon.get(`courses?q=${encodeURIComponent(title)}`)).json();
    expect(published).toHaveLength(1);
  });

  test('"+ Tạo khoá học" on the overview opens the form on the list', async ({ page }) => {
    await page.goto('/teacher');
    await page.getByRole('link', { name: '+ Tạo khoá học' }).click();
    await expect(page).toHaveURL(/\/teacher\/courses/);
    await expect(page.getByRole('dialog', { name: 'Tạo khoá học' })).toBeVisible();
  });
});

test.describe('teacher area as a student', () => {
  test.use({ storageState: storageStateFor('studentB') });

  test('shows the teacher-only notice and no course data', async ({ page }) => {
    await page.goto('/teacher/courses');
    await expect(page.getByRole('heading', { name: 'Khu vực dành cho Giáo viên' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    expect((await (await apiAs('studentB')).get('courses/manage')).status()).toBe(403);
  });
});
