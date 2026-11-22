import { expect, test } from '@playwright/test';
import { apiAs, storageStateFor } from '../fixtures/auth';
import { uniq } from '../fixtures/data';

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
