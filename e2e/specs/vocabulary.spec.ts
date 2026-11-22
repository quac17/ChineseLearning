import { expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { SEED, anonymousApi, apiAs } from '../fixtures/auth';
import { createPaidCourse, uniq } from '../fixtures/data';

// Seed: lesson-hsk1-b1 (free) has 9 words, lesson-hsk1-b2 (paid) has 10.

test.describe('vocabulary API', () => {
  test('follows lesson access: free is public, paid needs access', async () => {
    const anon = await anonymousApi();
    const free = await (await anon.get(`lessons/${SEED.hsk1FreeLesson}/vocabulary`)).json();
    expect(free).toHaveLength(9);
    expect(free[2]).toMatchObject({ hanzi: '你好', pinyin: 'nǐ hǎo', meaningVi: 'xin chào' });

    expect((await anon.get(`lessons/${SEED.hsk1PaidLesson}/vocabulary`)).status()).toBe(403);
    expect((await (await apiAs('studentB')).get(`lessons/${SEED.hsk1PaidLesson}/vocabulary`)).status()).toBe(403);
    expect(await (await (await apiAs('studentA')).get(`lessons/${SEED.hsk1PaidLesson}/vocabulary`)).json()).toHaveLength(10);

    // The count is visible on locked lessons (it is not content).
    const course = await (await anon.get(`courses/${SEED.hsk1}`)).json();
    const paid = course.lessons.find((l: { id: string }) => l.id === SEED.hsk1PaidLesson);
    expect(paid).toMatchObject({ canWatch: false, vocabularyCount: 10 });
  });

  test('the owner teacher saves the list; pinyin numbers become tone marks', async () => {
    const teacher = await apiAs('teacher');
    const { courseId, lessonId } = await createPaidCourse(teacher);

    const saved = await teacher.put(`lessons/${lessonId}/vocabulary`, {
      data: {
        items: [
          { hanzi: '叫', pinyin: 'jiao4', meaningVi: 'tên là', exampleZh: '我叫兰。', exampleVi: 'Tôi tên là Lan.' },
          { hanzi: '你好', pinyin: 'ni3 hao3', meaningVi: 'xin chào' },
          { hanzi: '绿', pinyin: 'lv4', meaningVi: 'xanh lá' },
        ],
      },
    });
    expect(saved.status(), await saved.text()).toBe(200);
    expect((await saved.json()).map((w: { pinyin: string }) => w.pinyin)).toEqual(['jiào', 'nǐ hǎo', 'lǜ']);

    // Saving again replaces the whole list, in the given order.
    const replaced = await (
      await teacher.put(`lessons/${lessonId}/vocabulary`, { data: { items: [{ hanzi: '好', pinyin: 'hǎo', meaningVi: 'tốt' }] } })
    ).json();
    expect(replaced.map((w: { hanzi: string }) => w.hanzi)).toEqual(['好']);
    expect((await (await teacher.get(`courses/${courseId}`)).json()).lessons[0].vocabularyCount).toBe(1);

    // Missing fields are refused with a Vietnamese message.
    const bad = await teacher.put(`lessons/${lessonId}/vocabulary`, { data: { items: [{ hanzi: '', pinyin: 'a', meaningVi: 'x' }] } });
    expect(bad.status()).toBe(400);
    expect(JSON.stringify(await bad.json())).toContain('Thiếu chữ Hán');
  });

  test('only the owner teacher or an admin can save', async () => {
    const teacher = await apiAs('teacher');
    const { lessonId } = await createPaidCourse(teacher);
    const body = { data: { items: [{ hanzi: '好', pinyin: 'hao3', meaningVi: 'tốt' }] } };

    expect((await (await apiAs('studentA')).put(`lessons/${lessonId}/vocabulary`, body)).status()).toBe(403);
    expect((await (await anonymousApi()).put(`lessons/${lessonId}/vocabulary`, body)).status()).toBe(401);

    const admin = await apiAs('admin');
    const email = `gv-tu-${uniq()}@e2e.test`;
    await admin.post('users', { data: { email, password: 'Matkhau@123', fullName: 'Giáo viên khác', role: 'TEACHER' } });
    const other = await request.newContext();
    await other.post(`${API_URL}/auth/login`, { data: { email, password: 'Matkhau@123' } });
    expect((await other.put(`${API_URL}/lessons/${lessonId}/vocabulary`, body)).status()).toBe(403);

    expect((await admin.put(`lessons/${lessonId}/vocabulary`, body)).status()).toBe(200);
  });
});

test.describe('vocabulary in the player', () => {
  test('a free lesson opens on its words; a locked lesson shows no word tab', async ({ page }) => {
    await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1FreeLesson}`);
    await expect(page.getByRole('tab', { name: 'Từ vựng (9)' })).toHaveAttribute('aria-selected', 'true');
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('你好', { exact: true })).toBeVisible();
    await expect(panel.getByText('nǐ hǎo', { exact: true })).toBeVisible();
    await expect(panel.getByText('xin chào', { exact: true })).toBeVisible();
    await expect(panel.getByText('你好，我是老师。')).toBeVisible();

    await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1PaidLesson}`);
    await expect(page.getByRole('heading', { name: 'Bài học này đã khoá' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Từ vựng/ })).toHaveCount(0);
  });
});
