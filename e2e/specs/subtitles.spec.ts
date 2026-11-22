import { expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { apiAs, storageStateFor } from '../fixtures/auth';
import { createPaidCourse, setAccess, uniq } from '../fixtures/data';
import { newStudent } from '../fixtures/payments';

// Pinyin subtitles: a WebVTT file per uploaded-video lesson, served with the
// same access check as the video. YouTube lessons use YouTube's own subtitles.

const VTT = 'WEBVTT\n\n00:00.000 --> 00:02.000\nnǐ hǎo\n';
const vttFile = (body = VTT, name = 'bai-1.vtt', mimeType = 'text/vtt') => ({
  multipart: { file: { name, mimeType, buffer: Buffer.from(body, 'utf8') } },
});

test.describe('subtitle API', () => {
  test('upload rules, access like the video, replace and remove', async () => {
    const teacher = await apiAs('teacher');
    const { courseId, lessonId } = await createPaidCourse(teacher);

    // Students cannot upload; wrong format or content is refused.
    const studentA = await apiAs('studentA');
    expect((await studentA.post(`lessons/${lessonId}/subtitle`, vttFile())).status()).toBe(403);
    expect((await teacher.post(`lessons/${lessonId}/subtitle`, vttFile(VTT, 'bai-1.srt', 'text/plain'))).status()).toBe(400);
    expect((await teacher.post(`lessons/${lessonId}/subtitle`, vttFile('1\n00:00:00,000 --> 00:00:02,000\nhi'))).status()).toBe(400);
    expect((await teacher.post(`lessons/${lessonId}/subtitle`, vttFile(VTT, 'bai-1.vtt', 'text/html'))).status()).toBe(400);

    // Nothing uploaded yet → 404, and the lesson payload has no subtitle path.
    expect((await teacher.get(`lessons/${lessonId}/subtitle`)).status()).toBe(404);

    const up = await teacher.post(`lessons/${lessonId}/subtitle`, vttFile());
    expect(up.status(), await up.text()).toBe(201);
    expect(await up.json()).toMatchObject({ hasSubtitle: true, subtitlePath: `/lessons/${lessonId}/subtitle` });

    // Same gate as the stream: logged out and a student without access → 403.
    const anon = await request.newContext();
    expect((await anon.get(`${API_URL}/lessons/${lessonId}/subtitle`)).status()).toBe(403);
    const learner = await request.newContext();
    const student = await newStudent(learner);
    expect((await learner.get(`${API_URL}/lessons/${lessonId}/subtitle`)).status()).toBe(403);
    const locked = await (await learner.get(`${API_URL}/courses/${courseId}`)).json();
    expect(locked.lessons[0].subtitlePath).toBeNull();

    await setAccess(teacher, courseId, student.id, true);
    const res = await learner.get(`${API_URL}/lessons/${lessonId}/subtitle`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/vtt');
    expect(await res.text()).toBe(VTT);
    const open = await (await learner.get(`${API_URL}/courses/${courseId}`)).json();
    expect(open.lessons[0].subtitlePath).toBe(`/lessons/${lessonId}/subtitle`);

    // Replacing serves the new file; removing turns it off again.
    const v2 = 'WEBVTT\n\n00:00.000 --> 00:02.000\nnǐ hǎo ma?\n';
    expect((await teacher.post(`lessons/${lessonId}/subtitle`, vttFile(v2))).status()).toBe(201);
    expect(await (await learner.get(`${API_URL}/lessons/${lessonId}/subtitle`)).text()).toBe(v2);
    expect((await learner.delete(`${API_URL}/lessons/${lessonId}/subtitle`)).status()).toBe(403);
    expect((await teacher.delete(`lessons/${lessonId}/subtitle`)).status()).toBe(200);
    expect((await learner.get(`${API_URL}/lessons/${lessonId}/subtitle`)).status()).toBe(404);
  });

  test('YouTube lessons cannot get an uploaded subtitle', async () => {
    const teacher = await apiAs('teacher');
    const course = await (
      await teacher.post('courses', { data: { title: `E2E phụ đề ${uniq()}`, module: 'hsk', isFree: false } })
    ).json();
    const lesson = await (
      await teacher.post('lessons/youtube', { data: { courseId: course.id, title: 'Bài YouTube', youtubeUrl: 'jNQXAC9IVRw' } })
    ).json();
    expect((await teacher.post(`lessons/${lesson.id}/subtitle`, vttFile())).status()).toBe(400);
  });
});

test.describe('subtitles in the player', () => {
  test.use({ storageState: storageStateFor('teacher') });

  test('the video carries the pinyin track and the "Phụ đề pinyin" switch hides it', async ({ page }) => {
    const teacher = await apiAs('teacher');
    const { courseId, lessonId } = await createPaidCourse(teacher);
    expect((await teacher.post(`lessons/${lessonId}/subtitle`, vttFile())).status()).toBe(201);

    await page.goto(`/learn/${courseId}/${lessonId}`);
    const track = page.locator('video track[kind="subtitles"]');
    await expect(track).toHaveAttribute('src', `${API_URL}/lessons/${lessonId}/subtitle`);
    await expect(page.locator('video')).toHaveAttribute('crossorigin', 'use-credentials');

    const toggle = page.getByRole('switch', { name: 'Phụ đề pinyin' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect
      .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.textTracks[0]?.mode))
      .toBe('hidden');

    // The choice is remembered on this device.
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Phụ đề pinyin' })).toHaveAttribute('aria-checked', 'false');
  });

  test('no switch without a subtitle file', async ({ page }) => {
    const { courseId, lessonId } = await createPaidCourse(await apiAs('teacher'));
    await page.goto(`/learn/${courseId}/${lessonId}`);
    await expect(page.locator('video')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('switch', { name: 'Phụ đề pinyin' })).toHaveCount(0);
  });

  test('the teacher adds and removes the subtitle from the lessons tab', async ({ page }) => {
    const teacher = await apiAs('teacher');
    const { courseId, lessonId } = await createPaidCourse(teacher);
    const title = (await (await teacher.get(`courses/${courseId}`)).json()).lessons[0].title as string;

    await page.goto(`/teacher/courses/${courseId}/lessons`);
    await page.getByRole('button', { name: `Sửa bài ${title}` }).click();
    const form = page.getByRole('complementary', { name: 'Sửa bài giảng' });
    await form.getByLabel('Phụ đề pinyin', { exact: true }).setInputFiles({ name: 'bai.vtt', mimeType: 'text/vtt', buffer: Buffer.from(VTT) });
    await form.getByRole('button', { name: 'Lưu bài' }).click();
    await expect(form).toHaveCount(0);
    await expect.poll(async () => (await teacher.get(`lessons/${lessonId}/subtitle`)).status()).toBe(200);
    expect(await (await teacher.get(`lessons/${lessonId}/subtitle`)).text()).toBe(VTT);

    // A non-WebVTT file is refused, the lesson itself still saves.
    await page.getByRole('button', { name: `Sửa bài ${title}` }).click();
    await form.getByLabel('Phụ đề pinyin', { exact: true }).setInputFiles({ name: 'sai.vtt', mimeType: 'text/vtt', buffer: Buffer.from('hello') });
    await form.getByRole('button', { name: 'Lưu bài' }).click();
    await expect(page.getByText(/phụ đề chưa lưu được: Tệp không phải WebVTT/)).toBeVisible();

    await page.getByRole('button', { name: `Sửa bài ${title}` }).click();
    await form.getByLabel(/Xoá phụ đề hiện có khi lưu/).check();
    await form.getByRole('button', { name: 'Lưu bài' }).click();
    await expect(form).toHaveCount(0);
    await expect.poll(async () => (await teacher.get(`lessons/${lessonId}/subtitle`)).status()).toBe(404);
  });
});
