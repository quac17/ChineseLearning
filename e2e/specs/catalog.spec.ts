import { expect, test } from '@playwright/test';
import { anonymousApi } from '../fixtures/auth';

test.describe('course search API', () => {
  test('q matches title, description and teacher, case-insensitively', async () => {
    const api = await anonymousApi();
    const titles = async (qs: string) =>
      ((await (await api.get(`courses?${qs}`)).json()) as Array<{ title: string }>).map((c) => c.title);

    expect(await titles('q=hsk')).toEqual([expect.stringContaining('HSK 1')]);
    expect(await titles('q=THIẾU NHI')).toEqual([expect.stringContaining('YCT')]);
    expect(await titles('q=thiếu nhi')).toEqual([expect.stringContaining('YCT')]);
    expect((await titles('q=Cô Ngân')).length).toBeGreaterThanOrEqual(4);
    expect(await titles('q=khong-co-khoa-nay')).toEqual([]);
  });

  test('q ignores Vietnamese accents, including đ', async () => {
    const api = await anonymousApi();
    const titles = async (qs: string) =>
      ((await (await api.get(`courses?${qs}`)).json()) as Array<{ title: string }>).map((c) => c.title);

    const giaoTiep = await titles(`q=${encodeURIComponent('giao tiep')}`);
    expect(giaoTiep).toContain('Giao tiếp đời sống & Thương mại cơ bản');
    expect(giaoTiep).toContain('HSK 1 – Nền tảng giao tiếp & 150 từ vựng');
    expect(await titles(`q=${encodeURIComponent('DOI SONG')}`)).toEqual(['Giao tiếp đời sống & Thương mại cơ bản']);
    expect(await titles(`q=${encodeURIComponent('thieu nhi')}`)).toEqual([expect.stringContaining('YCT')]);
    expect((await titles(`q=${encodeURIComponent('co ngan')}`)).length).toBeGreaterThanOrEqual(4);
    expect(await titles(`q=${encodeURIComponent('giao tiep%')}`)).toEqual([]);
  });

  test('wildcards are literal and q combines with module', async () => {
    const api = await anonymousApi();
    expect(await (await api.get('courses?q=%25')).json()).toEqual([]);
    expect(await (await api.get('courses?q=_')).json()).toEqual([]);
    const easyOnly = await (await api.get('courses?q=Cô Ngân&module=easy')).json();
    expect(easyOnly.map((c: { module: string }) => c.module)).toEqual(['easy']);
  });
});

test('search from the header lists matching courses', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Tìm khoá học' });
  await search.fill('thiếu nhi');
  await search.press('Enter');

  await expect(page).toHaveURL(/\/courses\?q=/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('1 kết quả cho “thiếu nhi”');
  await page.getByRole('link', { name: /YCT 1/ }).click();
  await expect(page).toHaveURL(/\/courses\/course-yct1$/);
});

test('program chips and price filter narrow the catalog', async ({ page }) => {
  await page.goto('/courses');
  await page.getByRole('navigation', { name: 'Lọc theo chương trình' }).getByRole('link', { name: 'Easy Steps' }).click();
  await expect(page).toHaveURL(/program=easy/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Khoá học Easy Steps');

  await page.goto('/courses');
  await page.getByLabel('Miễn phí').check();
  const results = page.getByRole('region', { name: 'Kết quả' }).getByRole('listitem');
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText('Easy Steps');
});

test.describe('catalog on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('edit the keyword in place; filters sit behind "Bộ lọc · n"', async ({ page }) => {
    await page.goto('/courses?q=thiếu nhi');
    const results = page.getByRole('region', { name: 'Kết quả' }).getByRole('listitem');
    await expect(results).toHaveCount(1);

    // One search box on the page: the header one steps aside on the catalog.
    const search = page.getByRole('searchbox', { name: 'Tìm khoá học' });
    await expect(search).toHaveCount(1);
    await expect(search).toHaveValue('thiếu nhi');
    // Seed titles only: Easy Steps and YCT 1 say "Tiếng Trung".
    await search.fill('Tiếng Trung');
    await search.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('2 kết quả cho “Tiếng Trung”');
    await expect(results).toHaveCount(2);

    // Filters are collapsed; the wide-screen sidebar is hidden.
    await expect(page.getByRole('complementary', { name: 'Bộ lọc' })).toBeHidden();
    await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Bộ lọc' });
    await sheet.getByLabel('Easy Steps').check();
    await expect(page).toHaveURL(/program=easy/);
    await sheet.getByLabel('Miễn phí').check();
    await sheet.getByRole('button', { name: 'Xem 1 kết quả' }).click();
    await expect(sheet).toBeHidden();
    await expect(results).toHaveCount(1);

    // Active chips show under the search box and remove their filter.
    await expect(page.getByRole('button', { name: 'Bộ lọc · 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Bỏ lọc Easy Steps' }).click();
    await expect(page).not.toHaveURL(/program=/);
    await expect(page.getByRole('button', { name: 'Bộ lọc · 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Bỏ lọc Miễn phí' }).click();
    await expect(page.getByRole('button', { name: 'Bộ lọc', exact: true })).toBeVisible();
    await expect(results).toHaveCount(2);
  });

  test('"Tìm gần đây" remembers searches in this browser', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 });
    await page.goto('/courses?q=hsk');
    await expect(h1).toHaveText('1 kết quả cho “hsk”');
    await page.goto('/courses?q=thiếu nhi');
    await expect(h1).toHaveText('1 kết quả cho “thiếu nhi”');

    const recent = page.getByRole('region', { name: 'Tìm gần đây' });
    await expect(recent.getByRole('link')).toHaveText(['hsk']);
    await page.goto('/courses');
    await expect(recent.getByRole('link')).toHaveText(['thiếu nhi', 'hsk']);

    await recent.getByRole('link', { name: 'hsk' }).click();
    await expect(h1).toHaveText('1 kết quả cho “hsk”');
    await expect(page.getByRole('searchbox', { name: 'Tìm khoá học' })).toHaveValue('hsk');

    await recent.getByRole('button', { name: 'Xoá lịch sử' }).click();
    await expect(recent).toHaveCount(0);
    await page.reload();
    await expect(h1).toHaveText('1 kết quả cho “hsk”');
    await expect(recent).toHaveCount(0);
  });

  test('search still works when storage is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    await page.goto('/courses?q=hsk');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('1 kết quả cho “hsk”');
    await expect(page.getByRole('region', { name: 'Tìm gần đây' })).toHaveCount(0);
  });
});
