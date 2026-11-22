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
