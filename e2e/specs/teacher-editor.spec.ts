import { APIRequestContext, expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { anonymousApi, apiAs, storageStateFor } from '../fixtures/auth';
import { setAccess, uniq } from '../fixtures/data';

// Course editor (/teacher/courses/:id/<tab>). Each test makes its own course.

async function newCourse(teacher: APIRequestContext, extra: Record<string, unknown> = {}) {
  const res = await teacher.post('courses', {
    data: { title: `E2E trình sửa ${uniq()}`, module: 'hsk', isFree: false, isPublished: true, ...extra },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: string; title: string };
}

/** A fresh student on its own API context (never shares access with other specs). */
async function freshStudent() {
  const api = await request.newContext({ baseURL: `${API_URL}/`, storageState: { cookies: [], origins: [] } });
  const res = await api.post('auth/register', {
    data: { fullName: 'Học viên trình sửa', email: `ts-${uniq()}@e2e.test`, password: 'Matkhau@123', acceptTerms: true },
  });
  expect(res.status(), await res.text()).toBe(201);
  const { user } = await res.json();
  return { api, id: user.id as string };
}

test.describe('course editor', () => {
  test.use({ storageState: storageStateFor('teacher') });

  test('info tab saves the course and publishes it', async ({ page }) => {
    const course = await newCourse(await apiAs('teacher'), { isPublished: false });
    await page.goto(`/teacher/courses/${course.id}`);
    await expect(page).toHaveURL(new RegExp(`/teacher/courses/${course.id}/info$`));
    await expect(page.getByRole('link', { name: 'Thông tin' })).toHaveAttribute('aria-current', 'page');

    const title = `${course.title} (đã sửa)`;
    await page.getByLabel('Tên khoá học').fill(title);
    await page.getByLabel('Chương trình').selectOption('talk');
    await page.getByLabel('Mô tả chi tiết').fill('Khoá thử nghiệm của e2e.');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Đã lưu thông tin khoá học')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    await page.getByRole('switch', { name: 'Hiện trong danh mục' }).click();
    await expect(page.getByText(/Đã xuất bản: học viên thấy khoá/)).toBeVisible();
    const saved = await (await (await anonymousApi()).get(`courses/${course.id}`)).json();
    expect(saved).toMatchObject({ title, module: 'talk', isPublished: true, description: 'Khoá thử nghiệm của e2e.' });
  });

  test('lessons tab: YouTube preview and uploaded paid video; a granted student streams it', async ({ page }) => {
    const course = await newCourse(await apiAs('teacher'));
    await page.goto(`/teacher/courses/${course.id}/lessons`);

    await page.getByRole('button', { name: '+ Thêm bài' }).click();
    const form = page.getByRole('complementary', { name: 'Thêm bài giảng' });
    await form.getByLabel('Tiêu đề').fill('Bài 1: Xin chào');
    await form.getByLabel(/Link YouTube \(chỉ nên/).check();
    await form.getByLabel('Link YouTube', { exact: true }).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await form.getByLabel('Học thử: cho xem miễn phí').check();
    await form.getByRole('button', { name: 'Lưu bài' }).click();
    await expect(page.getByText('Đã thêm bài giảng vào cuối danh sách')).toBeVisible();

    await page.getByRole('button', { name: '+ Thêm bài' }).click();
    await form.getByLabel('Tiêu đề').fill('Bài 2: Thanh điệu');
    await form.getByLabel('Tệp video').setInputFiles({ name: 'bai2.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(4096, 1) });
    await form.getByLabel('Thời lượng (phút)').fill('12');
    await form.getByRole('button', { name: 'Lưu bài' }).click();
    await expect(form).toHaveCount(0);

    const rows = page.getByRole('list').filter({ hasText: 'Bài 1: Xin chào' }).getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('YouTube');
    await expect(rows.nth(1)).toContainText('Video tải lên');
    await expect(rows.nth(1)).toContainText('12 phút');

    // Reorder: the uploaded lesson goes first.
    await page.getByRole('button', { name: 'Đưa bài "Bài 2: Thanh điệu" lên' }).click();
    await expect(rows.nth(0)).toContainText('Bài 2: Thanh điệu');

    const lessons = (await (await (await apiAs('teacher')).get(`courses/${course.id}`)).json()).lessons;
    expect(lessons.map((l: { title: string }) => l.title)).toEqual(['Bài 2: Thanh điệu', 'Bài 1: Xin chào']);
    const [paid, preview] = lessons;
    expect(preview).toMatchObject({ isFree: true, sourceType: 'YOUTUBE', youtubeId: 'dQw4w9WgXcQ' });

    const student = await freshStudent();
    expect((await student.api.get(`lessons/${paid.id}/stream`)).status()).toBe(403);
    await setAccess(await apiAs('teacher'), course.id, student.id, true);
    expect((await student.api.get(`lessons/${paid.id}/stream`)).status()).toBe(200);
  });

  test('documents tab: uploads a paid and a free document; students download what they may', async ({ page }) => {
    const course = await newCourse(await apiAs('teacher'));
    await page.goto(`/teacher/courses/${course.id}/documents`);
    const form = page.getByRole('complementary', { name: 'Thêm tài liệu' });

    await form.getByLabel('Tên tài liệu').fill('Giáo trình bài 1');
    await form.getByLabel('Tệp tài liệu').setInputFiles({
      name: 'giao-trinh.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.alloc(1024, 1),
    });
    await form.getByRole('button', { name: 'Tải lên' }).click();
    await expect(page.getByText('Đã tải tài liệu lên')).toBeVisible();

    await form.getByLabel('Tên tài liệu').fill('Slide học thử');
    await form.getByLabel('Tệp tài liệu').setInputFiles({
      name: 'slide.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: Buffer.alloc(1024, 2),
    });
    await form.getByLabel('Cho người chưa mua tải (tài liệu học thử)').check();
    await form.getByRole('button', { name: 'Tải lên' }).click();

    const table = page.getByRole('table');
    await expect(table.getByRole('row', { name: /Slide học thử/ })).toContainText('Học thử');
    await expect(table.getByRole('row', { name: /Giáo trình bài 1/ })).toContainText('Học viên có quyền');

    const docs = (await (await (await apiAs('teacher')).get(`courses/${course.id}`)).json()).documents;
    const paid = docs.find((d: { title: string }) => d.title === 'Giáo trình bài 1');
    const free = docs.find((d: { title: string }) => d.title === 'Slide học thử');

    const anon = await anonymousApi();
    expect((await anon.get(`documents/${free.id}/download`)).status()).toBe(200);
    expect((await anon.get(`documents/${paid.id}/download`)).status()).toBe(403);

    const student = await freshStudent();
    await setAccess(await apiAs('teacher'), course.id, student.id, true);
    expect((await student.api.get(`documents/${paid.id}/download`)).status()).toBe(200);

    // Rename through the edit form.
    await table.getByRole('button', { name: 'Sửa tài liệu Giáo trình bài 1' }).click();
    const edit = page.getByRole('complementary', { name: 'Sửa tài liệu' });
    await edit.getByLabel('Tên tài liệu').fill('Giáo trình bài 1 (bản mới)');
    await edit.getByRole('button', { name: 'Lưu tài liệu' }).click();
    await expect(table.getByRole('row', { name: /Giáo trình bài 1 \(bản mới\)/ })).toBeVisible();
  });

  test('a teacher cannot delete a course that has learners', async () => {
    const teacher = await apiAs('teacher');
    const withLearner = await newCourse(teacher);
    const student = await freshStudent();
    await setAccess(teacher, withLearner.id, student.id, true);
    const refused = await teacher.delete(`courses/${withLearner.id}`);
    expect(refused.status()).toBe(400);
    expect((await refused.json()).message).toContain('đã có học viên');

    const empty = await newCourse(teacher);
    expect((await teacher.delete(`courses/${empty.id}`)).ok()).toBeTruthy();
  });
});
