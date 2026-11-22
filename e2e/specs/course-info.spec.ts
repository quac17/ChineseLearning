import { APIRequestContext, expect, test } from '@playwright/test';
import { anonymousApi, apiAs } from '../fixtures/auth';
import { uniq } from '../fixtures/data';

/** Smallest valid PNG (1×1). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function newCourse(teacher: APIRequestContext, data: Record<string, unknown> = {}) {
  const res = await teacher.post('courses', {
    data: { title: `E2E thông tin khoá ${uniq()}`, module: 'hsk', isFree: true, ...data },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: string; title: string };
}

test.describe('course info API (#28)', () => {
  test('teacher saves subtitle, level and outcomes; blanks are cleaned', async () => {
    const teacher = await apiAs('teacher');
    const course = await newCourse(teacher, { subtitle: 'Học chào hỏi trong 7 ngày', level: 'BEGINNER' });
    const res = await teacher.patch(`courses/${course.id}`, {
      data: { outcomes: ['  Đọc đúng pinyin ', '', 'Chào hỏi', 'Chào hỏi'], level: 'INTERMEDIATE' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();

    const view = await (await (await anonymousApi()).get(`courses/${course.id}`)).json();
    expect(view).toMatchObject({
      subtitle: 'Học chào hỏi trong 7 ngày',
      level: 'INTERMEDIATE',
      outcomes: ['Đọc đúng pinyin', 'Chào hỏi'],
      coverUrl: null,
      totalDurationMinutes: 0,
    });

    // "" clears the subtitle; null clears the level.
    await teacher.patch(`courses/${course.id}`, { data: { subtitle: '', level: null } });
    const cleared = await (await teacher.get(`courses/${course.id}`)).json();
    expect([cleared.subtitle, cleared.level]).toEqual([null, null]);
  });

  test('rejects a long subtitle, an unknown level and too many outcomes', async () => {
    const teacher = await apiAs('teacher');
    const course = await newCourse(teacher);
    const bad = async (data: Record<string, unknown>, message: string) => {
      const res = await teacher.patch(`courses/${course.id}`, { data });
      expect(res.status()).toBe(400);
      expect(JSON.stringify(await res.json())).toContain(message);
    };
    await bad({ subtitle: 'x'.repeat(121) }, 'Mô tả ngắn tối đa 120 ký tự');
    await bad({ level: 'EXPERT' }, 'Cấp độ phải là');
    await bad({ outcomes: Array.from({ length: 13 }, (_, i) => `Ý ${i}`) }, 'Tối đa 12 ý');
  });

  test('lesson minutes come from the number or the free text, and add up', async () => {
    const teacher = await apiAs('teacher');
    const course = await newCourse(teacher);
    const add = (data: Record<string, unknown>) =>
      teacher.post('lessons/youtube', {
        data: { courseId: course.id, title: `Bài ${uniq()}`, youtubeUrl: 'dQw4w9WgXcQ', isFree: true, ...data },
      });
    const a = await (await add({ duration: '12 phút' })).json();
    const b = await (await add({ duration: 'khoảng nửa tiếng', durationMinutes: 30 })).json();
    await add({ duration: 'chưa rõ' });
    expect([a.duration_minutes, b.duration_minutes]).toEqual([12, 30]);

    let view = await (await teacher.get(`courses/${course.id}`)).json();
    expect(view.totalDurationMinutes).toBe(42);
    expect(view.lessons.map((l: { durationMinutes: number | null }) => l.durationMinutes)).toEqual([12, 30, null]);

    // Changing the text re-reads the minutes unless they are sent too.
    await teacher.patch(`lessons/${a.id}`, { data: { duration: '1:05:00' } });
    view = await (await teacher.get(`courses/${course.id}`)).json();
    expect(view.totalDurationMinutes).toBe(95);

    const tooLong = await teacher.patch(`lessons/${a.id}`, { data: { durationMinutes: 601 } });
    expect(tooLong.status()).toBe(400);
  });

  test('cover upload: owner only, image bytes only, served publicly, replaced and removed', async () => {
    const teacher = await apiAs('teacher');
    const course = await newCourse(teacher);
    const anon = await anonymousApi();
    const file = (name: string, mimeType: string, buffer: Buffer) => ({ multipart: { file: { name, mimeType, buffer } } });

    expect((await anon.post(`courses/${course.id}/cover`, file('a.png', 'image/png', PNG))).status()).toBe(401);
    expect((await (await apiAs('studentA')).post(`courses/${course.id}/cover`, file('a.png', 'image/png', PNG))).status()).toBe(403);

    // An SVG or a renamed text file is refused.
    const svg = await teacher.post(`courses/${course.id}/cover`, file('a.svg', 'image/svg+xml', Buffer.from('<svg/>')));
    expect(svg.status()).toBe(400);
    const fake = await teacher.post(`courses/${course.id}/cover`, file('a.png', 'image/png', Buffer.from('<html>not a png</html>')));
    expect(fake.status()).toBe(400);
    expect((await fake.json()).message).toBe('Ảnh bìa phải là tệp JPG, PNG hoặc WebP.');

    const up = await teacher.post(`courses/${course.id}/cover`, file('bia.png', 'image/png', PNG));
    expect(up.status(), await up.text()).toBe(201);
    const { coverUrl } = await up.json();
    expect(coverUrl).toMatch(new RegExp(`^/courses/${course.id}/cover\\?v=`));

    const img = await anon.get(coverUrl.slice(1));
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toBe('image/png');
    expect(img.headers()['x-content-type-options']).toBe('nosniff');

    const second = await (await teacher.post(`courses/${course.id}/cover`, file('moi.png', 'image/png', PNG))).json();
    expect(second.coverUrl).not.toBe(coverUrl);

    expect((await teacher.delete(`courses/${course.id}/cover`)).ok()).toBeTruthy();
    expect((await anon.get(`courses/${course.id}/cover`)).status()).toBe(404);
    expect((await (await anon.get(`courses/${course.id}`)).json()).coverUrl).toBeNull();
  });
});

test.describe('course info in the learner pages', () => {
  test('course page shows subtitle, level, "Bạn sẽ học được" and the cover', async ({ page }) => {
    const teacher = await apiAs('teacher');
    const course = await newCourse(teacher, {
      subtitle: 'Câu ngắn dưới tên khoá',
      level: 'BEGINNER',
      outcomes: ['Đọc đúng bốn thanh điệu', 'Chào hỏi và giới thiệu bản thân'],
    });
    await teacher.post(`courses/${course.id}/cover`, { multipart: { file: { name: 'bia.png', mimeType: 'image/png', buffer: PNG } } });
    await teacher.post('lessons/youtube', {
      data: { courseId: course.id, title: 'Bài 1 thử', youtubeUrl: 'dQw4w9WgXcQ', isFree: true, durationMinutes: 75 },
    });

    await page.goto(`/courses/${course.id}`);
    await expect(page.getByText('Câu ngắn dưới tên khoá')).toBeVisible();
    await expect(page.getByText('Mới bắt đầu', { exact: true })).toBeVisible();
    const learn = page.getByRole('region', { name: 'Bạn sẽ học được' });
    await expect(learn.getByRole('listitem')).toHaveText([/Đọc đúng bốn thanh điệu/, /Chào hỏi và giới thiệu bản thân/]);
    await expect(page.getByText('1 bài · tổng 1 giờ 15 phút')).toBeVisible();
    await expect(page.getByRole('complementary').locator('img')).toHaveAttribute('src', /\/cover\?v=/);
  });

  test('catalog filters by level and total duration', async ({ page }) => {
    const teacher = await apiAs('teacher');
    const tag = uniq();
    const long = await newCourse(teacher, { title: `E2E lọc dài ${tag}`, level: 'ADVANCED' });
    for (let i = 0; i < 2; i++) {
      await teacher.post('lessons/youtube', {
        data: { courseId: long.id, title: `Bài ${i}`, youtubeUrl: 'dQw4w9WgXcQ', isFree: true, durationMinutes: 400 },
      });
    }
    await newCourse(teacher, { title: `E2E lọc ngắn ${tag}`, level: 'BEGINNER' });

    await page.goto(`/courses?q=${encodeURIComponent(tag)}`);
    const results = page.getByRole('region', { name: 'Kết quả' }).getByRole('listitem');
    await expect(results).toHaveCount(2);
    await page.getByLabel('HSK 5–6 · Nâng cao').check();
    await expect(results).toHaveCount(1);
    await expect(results.first()).toContainText(`E2E lọc dài ${tag}`);
    await expect(results.first()).toContainText('13 giờ 20 phút');
    await page.getByLabel('Dưới 3 giờ').check();
    await expect(results).toHaveCount(0);
    await page.getByLabel('Trên 10 giờ').check();
    await expect(results).toHaveCount(1);
    await page.getByRole('button', { name: 'Xoá lọc' }).click();
    await expect(results).toHaveCount(2);
  });
});
