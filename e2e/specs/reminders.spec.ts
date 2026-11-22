import { APIRequestContext, expect, request, test } from '@playwright/test';
import { API_URL, REMINDER_SECRET, WEB_URL } from '../env';
import { SEED, anonymousApi } from '../fixtures/auth';
import { linkIn, mailsTo } from '../fixtures/mail';
import { newStudent } from '../fixtures/payments';

// Daily review reminder by email (#38). Each test uses fresh students; the job
// mails every opted-in learner with due words, at most once per Vietnam day.

const SUBJECT = 'Hôm nay bạn có từ cần ôn';

async function runJob(api: APIRequestContext, secret: string | null = REMINDER_SECRET) {
  return api.post(`${API_URL}/reminders/run`, { headers: secret ? { 'X-Cron-Secret': secret } : {} });
}

/** Marks two words of the free HSK 1 lesson "Chưa nhớ", so they are due now. */
async function makeWordsDue(api: APIRequestContext) {
  const { words } = await (await api.get(`${API_URL}/practice/words?lessonId=${SEED.hsk1FreeLesson}`)).json();
  const res = await api.post(`${API_URL}/practice/reviews`, {
    data: { results: words.slice(0, 2).map((w: { id: string }) => ({ vocabularyId: w.id, outcome: 'forgot' })) },
  });
  expect(res.status(), await res.text()).toBe(201);
}

async function setReminder(api: APIRequestContext, enabled: boolean) {
  const res = await api.put(`${API_URL}/reminders/settings`, { data: { enabled } });
  expect(res.status(), await res.text()).toBe(200);
}

test.describe('the switch on the account page', () => {
  test('is off by default and the choice survives a reload (desktop)', async ({ page }) => {
    await newStudent(page.request);
    await page.goto('/account');
    const toggle = page.getByRole('switch', { name: 'Nhắc ôn tập mỗi ngày' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toBeEnabled();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Đã bật nhắc ôn tập mỗi ngày.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('switch', { name: 'Nhắc ôn tập mỗi ngày' })).toHaveAttribute('aria-checked', 'true');
    expect(await (await page.request.get(`${API_URL}/reminders/settings`)).json()).toEqual({ enabled: true });
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('sits in the "Học tập" list and turns off again', async ({ page }) => {
      await newStudent(page.request);
      await setReminder(page.request, true);
      await page.goto('/account');
      const toggle = page.getByRole('switch', { name: 'Nhắc ôn tập mỗi ngày' });
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
      await page.reload();
      await expect(page.getByRole('switch', { name: 'Nhắc ôn tập mỗi ngày' })).toHaveAttribute('aria-checked', 'false');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });
  });

  test('is only for logged-in users', async () => {
    const anon = await anonymousApi();
    expect((await anon.get('reminders/settings')).status()).toBe(401);
    expect((await anon.put('reminders/settings', { data: { enabled: true } })).status()).toBe(401);
  });
});

test.describe('the daily job', () => {
  test('mails a learner with due words once a day, with a working unsubscribe link', async ({ page }) => {
    const learner = await request.newContext();
    const { email } = await newStudent(learner);
    await makeWordsDue(learner);
    await setReminder(learner, true);

    // Opted in but nothing due: no mail.
    const idle = await request.newContext();
    const { email: idleEmail } = await newStudent(idle);
    await setReminder(idle, true);

    // Due words but never opted in: no mail.
    const quiet = await request.newContext();
    const { email: quietEmail } = await newStudent(quiet);
    await makeWordsDue(quiet);

    const first = await runJob(learner);
    expect(first.status(), await first.text()).toBe(200);
    const mails = await mailsTo(learner, email, SUBJECT);
    expect(mails).toHaveLength(1);
    expect(mails[0].text).toContain('2 từ');
    expect(mails[0].text).toContain(`${WEB_URL}/flashcards?due=true`);
    expect(await mailsTo(learner, idleEmail, SUBJECT)).toHaveLength(0);
    expect(await mailsTo(learner, quietEmail, SUBJECT)).toHaveLength(0);

    // A second run the same day sends nothing new.
    expect((await runJob(learner)).status()).toBe(200);
    expect(await mailsTo(learner, email, SUBJECT)).toHaveLength(1);

    // The link in the mail turns the reminder off without logging in.
    await page.goto(linkIn(mails[0], `${WEB_URL}/unsubscribe?`));
    await expect(page.getByRole('heading', { name: 'Tắt nhắc ôn tập?' })).toBeVisible();
    await page.getByRole('button', { name: 'Tắt nhắc ôn tập' }).click();
    await expect(page.getByRole('heading', { name: 'Đã tắt nhắc ôn tập' })).toBeVisible();
    expect(await (await learner.get(`${API_URL}/reminders/settings`)).json()).toEqual({ enabled: false });
  });

  test('refuses runs without the scheduler secret and forged unsubscribe links', async () => {
    const anon = await anonymousApi();
    expect((await runJob(anon, null)).status()).toBe(401);
    expect((await runJob(anon, 'sai-ma-bi-mat')).status()).toBe(401);

    const learner = await request.newContext();
    const { id } = await newStudent(learner);
    await setReminder(learner, true);
    const forged = await anon.post(`reminders/unsubscribe?u=${id}&s=khong-phai-chu-ky`);
    expect(forged.status()).toBe(400);
    expect(await (await learner.get(`${API_URL}/reminders/settings`)).json()).toEqual({ enabled: true });
  });
});
