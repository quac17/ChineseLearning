import { expect, test } from '@playwright/test';
import { API_URL } from '../env';
import { SEED, storageStateFor } from '../fixtures/auth';

// The service worker is registered by production builds only. Locally the
// client runs `next dev`; CI (and `CI=1 yarn e2e`) runs `next build && next start`.
const isProd = Boolean(process.env.CI);

test('the manifest makes the app installable: name, icons, standalone', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m).toMatchObject({ name: 'Chinese Learner – Học tiếng Trung', short_name: 'Chinese Learner', start_url: '/', scope: '/', display: 'standalone', lang: 'vi' });
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBeTruthy();
  for (const icon of m.icons) expect((await request.get(icon.src)).ok(), icon.src).toBeTruthy();
  expect((await request.get('/apple-icon.png')).ok()).toBeTruthy();
});

test('next dev registers no service worker', async ({ page }) => {
  test.skip(isProd, 'production build registers the worker');
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBe(0);
});

test.describe('production service worker', () => {
  test.skip(!isProd, 'the worker is registered by production builds only (run with CI=1)');
  test.use({ storageState: storageStateFor('studentA') });

  test('installs, caches only the shell, never API or media, and serves the offline page', async ({ page, context }) => {
    await page.goto('/');
    const script = await page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.active?.scriptURL));
    expect(script).toMatch(/\/sw\.js$/);

    // Browse while controlled: a course page, a paid lesson (API + stream) and a document list.
    await page.reload();
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.goto(`/courses/${SEED.hsk1}`);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1PaidLesson}`);
    await expect(page.getByRole('main').or(page.locator('#main')).first()).toBeVisible();

    const cached: string[] = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
      }
      return urls;
    });
    const origin = new URL(page.url()).origin;
    expect(cached).toContain(`${origin}/offline`);
    for (const url of cached) {
      expect(url.startsWith(origin), url).toBeTruthy();
      expect(url.startsWith(API_URL), url).toBeFalsy();
      expect(url, url).not.toMatch(/\/api\/|\/uploads\/|\/stream|\/download/);
      const path = new URL(url).pathname;
      // Only the offline page, the manifest and build/brand assets.
      expect(path === '/offline' || path === '/manifest.webmanifest' || /^\/(_next\/static|brand)\//.test(path), url).toBeTruthy();
    }

    await context.setOffline(true);
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: 'Bạn đang ngoại tuyến' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();

    await context.setOffline(false);
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByRole('heading', { name: 'Bạn đang ngoại tuyến' })).toBeHidden();
  });

  test('Chrome reports no installability errors', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
      installabilityErrors: { errorId: string }[];
    };
    expect(installabilityErrors).toEqual([]);
  });
});
