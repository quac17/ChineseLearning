import { expect, test } from '@playwright/test';
import { SEED, storageStateFor } from '../fixtures/auth';
import { newStudent } from '../fixtures/payments';

// AppCourse board: at phone width the price + "Mua bằng QR" sit in a bar
// fixed above the tab bar. Seed: HSK 1 on sale at 499.000 ₫, course-talk1 not on sale.

const PHONE = { width: 375, height: 812 };

test.describe('course page at phone width', () => {
  test.use({ viewport: PHONE });

  test('logged out: the buy bar is on screen without scrolling and leads to login', async ({ page }) => {
    await page.goto(`/courses/${SEED.hsk1}`);
    const bar = page.getByTestId('mobile-buy-bar');
    await expect(bar.getByText('499.000 ₫')).toBeInViewport();
    const buy = bar.getByRole('link', { name: 'Mua bằng QR' });
    await expect(buy).toBeInViewport();

    // It sits above the tab bar, not under it.
    const barBox = await bar.boundingBox();
    const tabsBox = await page.getByRole('navigation', { name: 'Điều hướng chính' }).boundingBox();
    expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(tabsBox!.y + 1);

    await buy.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fcourses%2Fcourse-hsk1/);
  });

  test('a new student buys from the bar and lands on the checkout page', async ({ page }) => {
    await newStudent(page.request);
    await page.goto(`/courses/${SEED.hsk1}`);
    await page.getByTestId('mobile-buy-bar').getByRole('button', { name: 'Mua bằng QR' }).click();
    await expect(page).toHaveURL(/\/checkout\/order-/);
  });

  test('a course not on sale shows no bar', async ({ page }) => {
    await page.goto('/courses/course-talk1');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('mobile-buy-bar')).toHaveCount(0);
  });

  test.describe('with access', () => {
    test.use({ storageState: storageStateFor('studentA') });

    test('the bar says "Vào học" instead of a price', async ({ page }) => {
      await page.goto(`/courses/${SEED.hsk1}`);
      const bar = page.getByTestId('mobile-buy-bar');
      await expect(bar.getByRole('link', { name: 'Vào học' })).toBeInViewport();
      await expect(bar.getByText('499.000 ₫')).toHaveCount(0);
    });
  });
});

test('desktop: no bottom bar, the buy box is unchanged', async ({ page }) => {
  await page.goto(`/courses/${SEED.hsk1}`);
  await expect(page.getByRole('complementary', { name: 'Mở khoá khoá học' }).getByText('499.000 ₫')).toBeVisible();
  await expect(page.getByTestId('mobile-buy-bar')).toBeHidden();
});
