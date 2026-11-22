import { expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { apiAs, storageStateFor } from '../fixtures/auth';
import { uniq } from '../fixtures/data';
import { newStudent } from '../fixtures/payments';

// Vocabulary tab of the course editor; the words then show in the player.

test.use({ storageState: storageStateFor('teacher') });

test('teacher types and pastes words; a learner sees them in the player', async ({ page, browser }) => {
  const teacher = await apiAs('teacher');
  const course = await (
    await teacher.post('courses', { data: { title: `E2E từ vựng ${uniq()}`, module: 'hsk', isFree: false, isPublished: true } })
  ).json();
  const lessonRes = await teacher.post('lessons/youtube', {
    data: { courseId: course.id, title: 'Bài 1: Chào hỏi', isFree: true, youtubeUrl: 'dQw4w9WgXcQ' },
  });
  expect(lessonRes.status(), await lessonRes.text()).toBe(201);
  const lesson = await lessonRes.json();

  await page.goto(`/teacher/courses/${course.id}/vocabulary`);
  await expect(page.getByLabel('Bài', { exact: true })).toHaveValue(lesson.id);
  await expect(page.getByRole('heading', { name: 'Bài này chưa có từ vựng' })).toBeVisible();

  await page.getByRole('button', { name: '+ Thêm từ' }).click();
  await expect(page.getByLabel('Chữ Hán từ 1')).toBeFocused();
  await page.getByLabel('Chữ Hán từ 1').fill('你好');
  await page.getByLabel('Pinyin từ 1').fill('ni3 hao3');
  await expect(page.getByText('Số thanh sẽ đổi thành dấu khi lưu')).toBeVisible();
  await page.getByLabel('Nghĩa từ 1', { exact: true }).fill('xin chào');

  await page.getByRole('button', { name: 'Dán từ bảng tính' }).click();
  const dialog = page.getByRole('dialog', { name: 'Dán từ bảng tính' });
  await dialog.getByLabel('Nội dung dán từ bảng tính').fill('谢谢\txie4xie\tcảm ơn\t谢谢你。\tCảm ơn bạn.\nthiếu cột');
  await expect(dialog.getByText('Bỏ qua dòng 2')).toBeVisible();
  await dialog.getByRole('button', { name: 'Thêm 1 từ' }).click();
  await expect(page.getByLabel('Chữ Hán từ 2')).toHaveValue('谢谢');

  // Move the pasted word first, then save.
  await page.getByRole('button', { name: 'Đưa từ 2 lên' }).click();
  await expect(page.getByLabel('Chữ Hán từ 1')).toHaveValue('谢谢');
  await page.getByRole('button', { name: 'Lưu từ vựng' }).click();
  await expect(page.getByText('Đã lưu 2 từ vựng')).toBeVisible();
  await expect(page.getByLabel('Pinyin từ 1')).toHaveValue('xièxie');
  await expect(page.getByLabel('Pinyin từ 2')).toHaveValue('nǐ hǎo');
  await expect(page.getByLabel('Bài', { exact: true })).toContainText('(2 từ)');

  // A logged-out learner opens the free lesson in the player.
  const learner = await browser.newContext();
  const player = await learner.newPage();
  await player.goto(`/learn/${course.id}/${lesson.id}`);
  await expect(player.getByRole('tab', { name: 'Từ vựng (2)' })).toHaveAttribute('aria-selected', 'true');
  const panel = player.getByRole('tabpanel');
  await expect(panel.getByText('谢谢', { exact: true })).toBeVisible();
  await expect(panel.getByText('xièxie', { exact: true })).toBeVisible();
  await expect(panel.getByText('cảm ơn', { exact: true })).toBeVisible();
  await expect(panel.getByText('nǐ hǎo', { exact: true })).toBeVisible();
  await learner.close();
});

test('rows missing a field block the save with a message', async ({ page }) => {
  const teacher = await apiAs('teacher');
  const course = await (await teacher.post('courses', { data: { title: `E2E từ thiếu ${uniq()}`, module: 'yct' } })).json();
  await teacher.post('lessons/youtube', { data: { courseId: course.id, title: 'Bài 1', youtubeUrl: 'dQw4w9WgXcQ' } });

  await page.goto(`/teacher/courses/${course.id}/vocabulary`);
  await page.getByRole('button', { name: '+ Thêm từ' }).click();
  await page.getByLabel('Chữ Hán từ 1').fill('好');
  await page.getByRole('button', { name: 'Lưu từ vựng' }).click();
  await expect(page.getByText('Mỗi từ cần đủ chữ Hán, pinyin và nghĩa tiếng Việt.')).toBeVisible();
  await expect(page.getByLabel('Pinyin từ 1')).toHaveAttribute('aria-invalid', 'true');
});

// Issue #59: saving the list must not wipe learners' review progress on words that stay.
test('editing and adding words keeps learners\' review boxes', async ({ page }) => {
  const teacher = await apiAs('teacher');
  const course = await (
    await teacher.post('courses', { data: { title: `E2E giữ tiến độ ${uniq()}`, module: 'hsk', isFree: false, isPublished: true } })
  ).json();
  const lesson = await (
    await teacher.post('lessons/youtube', {
      data: { courseId: course.id, title: 'Bài 1', isFree: true, youtubeUrl: 'dQw4w9WgXcQ' },
    })
  ).json();
  const put = await teacher.put(`lessons/${lesson.id}/vocabulary`, {
    data: {
      items: [
        { hanzi: '你好', pinyin: 'nǐ hǎo', meaningVi: 'xin chào' },
        { hanzi: '再见', pinyin: 'zàijiàn', meaningVi: 'tạm biệt' },
      ],
    },
  });
  expect(put.status(), await put.text()).toBe(200);
  const [hello, bye] = (await put.json()) as { id: string }[];

  // A learner remembers 你好 once: box 2.
  const learner = await request.newContext();
  await newStudent(learner);
  const review = (vocabularyId: string) =>
    learner.post(`${API_URL}/practice/reviews`, { data: { results: [{ vocabularyId, outcome: 'remembered' }] } });
  expect((await (await review(hello.id)).json()).saved[0].box).toBe(2);

  // The teacher fixes a meaning, removes 再见 and adds a word in the tab.
  await page.goto(`/teacher/courses/${course.id}/vocabulary`);
  await expect(page.getByLabel('Chữ Hán từ 1')).toHaveValue('你好');
  await page.getByLabel('Nghĩa từ 1', { exact: true }).fill('xin chào (lời chào)');
  await page.getByRole('button', { name: 'Xoá từ 2' }).click();
  await page.getByRole('button', { name: '+ Thêm từ' }).click();
  await page.getByLabel('Chữ Hán từ 2').fill('谢谢');
  await page.getByLabel('Pinyin từ 2').fill('xièxie');
  await page.getByLabel('Nghĩa từ 2', { exact: true }).fill('cảm ơn');
  await page.getByRole('button', { name: 'Lưu từ vựng' }).click();
  await expect(page.getByText('Đã lưu 2 từ vựng')).toBeVisible();

  const words = (await (await teacher.get(`lessons/${lesson.id}/vocabulary`)).json()) as { id: string; meaningVi: string }[];
  expect(words[0]).toMatchObject({ id: hello.id, meaningVi: 'xin chào (lời chào)' });
  expect(words.map((w) => w.id)).not.toContain(bye.id);

  // Same word, progress kept: remembering it again moves it from box 2 to 3.
  expect((await (await review(hello.id)).json()).saved[0].box).toBe(3);
  await learner.dispose();
});

test('an id from another lesson is added as a new word, never moved', async () => {
  const teacher = await apiAs('teacher');
  const course = await (
    await teacher.post('courses', { data: { title: `E2E id lạ ${uniq()}`, module: 'hsk', isFree: false, isPublished: true } })
  ).json();
  const make = async (title: string) =>
    (await (await teacher.post('lessons/youtube', { data: { courseId: course.id, title, isFree: true, youtubeUrl: 'dQw4w9WgXcQ' } })).json()) as {
      id: string;
    };
  const [a, b] = [await make('Bài A'), await make('Bài B')];
  const [word] = await (
    await teacher.put(`lessons/${a.id}/vocabulary`, { data: { items: [{ hanzi: '你', pinyin: 'nǐ', meaningVi: 'bạn' }] } })
  ).json();

  const res = await teacher.put(`lessons/${b.id}/vocabulary`, {
    data: { items: [{ id: word.id, hanzi: '我', pinyin: 'wǒ', meaningVi: 'tôi' }] },
  });
  expect(res.status(), await res.text()).toBe(200);
  expect((await res.json())[0].id).not.toBe(word.id);
  expect(await (await teacher.get(`lessons/${a.id}/vocabulary`)).json()).toMatchObject([{ id: word.id, hanzi: '你' }]);

  const dup = await teacher.put(`lessons/${a.id}/vocabulary`, {
    data: { items: [{ id: word.id, hanzi: '你', pinyin: 'nǐ', meaningVi: 'bạn' }, { id: word.id, hanzi: '你', pinyin: 'nǐ', meaningVi: 'bạn' }] },
  });
  expect(dup.status()).toBe(400);
});
