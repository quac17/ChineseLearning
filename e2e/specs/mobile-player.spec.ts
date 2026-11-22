import { expect, test } from '@playwright/test';
import { SEED, apiAs } from '../fixtures/auth';
import { setAccess } from '../fixtures/data';
import { newStudent } from '../fixtures/payments';

// AppPlayer board: at phone width the video stays at the top and the page has
// two tabs, "Bài giảng" (lesson list with ticks) and "Từ vựng & tài liệu".
// Seed HSK 1: lesson b1 is free with vocabulary, b2 is paid; one free document.

const PHONE = { width: 375, height: 812 };

test.describe('player at phone width', () => {
  test.use({ viewport: PHONE });

  test('tabs, ticks, words, documents, next lesson and the sticky video', async ({ page }) => {
    test.slow(); // many steps and two page loads
    const student = await newStudent(page.request);
    await setAccess(await apiAs('teacher'), SEED.hsk1, student.id, true);

    await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1FreeLesson}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
    const lessonsTab = page.getByRole('tab', { name: 'Bài giảng' });
    await expect(lessonsTab).toHaveAttribute('aria-selected', 'true');
    // No desktop sidebar: the list lives in the tab.
    await expect(page.getByRole('complementary', { name: 'Nội dung khoá học' })).toHaveCount(0);

    // Tick lesson 2 from the list; it is saved.
    const tick2 = page.getByRole('checkbox', { name: /Đã học: 2\./ });
    await tick2.click();
    await expect(tick2).toBeChecked();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: /Đã học: 2\./ })).toBeChecked();

    // Words and documents share the second tab.
    await page.getByRole('tab', { name: 'Từ vựng & tài liệu' }).click();
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByRole('heading', { name: /Từ vựng \(\d+\)/ })).toBeVisible();
    await expect(panel.getByText('nǐ').first()).toBeVisible();
    await expect(panel.getByRole('heading', { name: /Tài liệu \(\d+\)/ })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Tải về' }).first()).toBeVisible();

    // The video stays on screen while the page scrolls.
    const video = page.locator('iframe');
    await expect(video).toBeVisible();
    await page.mouse.wheel(0, 1200);
    await expect(video).toBeInViewport();
    expect(await video.evaluate((el) => getComputedStyle(el.parentElement!).position)).toBe('sticky');

    // Moving on still works from the list.
    await page.getByRole('tab', { name: 'Bài giảng' }).click();
    await page.getByRole('link', { name: /^2\./ }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${SEED.hsk1}/${SEED.hsk1PaidLesson}`));
    // Lesson 2 was ticked above, so its title row says so.
    await expect(page.getByRole('button', { name: '✓ Đã học' })).toBeVisible();
  });

  test('a locked lesson still says what to do, with the list in its tab', async ({ page }) => {
    await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1PaidLesson}`);
    await expect(page.getByRole('heading', { name: 'Bài học này đã khoá' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Xem bài học thử' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Bài giảng' })).toBeVisible();
  });
});

test('desktop keeps the two-column player with the sidebar', async ({ page }) => {
  await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1FreeLesson}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('complementary', { name: 'Nội dung khoá học' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Bài giảng' })).toHaveCount(0);
});
