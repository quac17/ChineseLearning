import { expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { SEED, apiAs, storageStateFor } from '../fixtures/auth';
import { createPaidCourse, setAccess } from '../fixtures/data';
import { newStudent } from '../fixtures/payments';

// Notes are private per learner (optionally pinned to a video second); Q&A is
// for learners with course access, answered by the course's teacher or an admin.

const note = (api: Awaited<ReturnType<typeof request.newContext>>, data: object) =>
  api.post(`${API_URL}/notes`, { data });
const ask = (api: Awaited<ReturnType<typeof request.newContext>>, lessonId: string, body: string) =>
  api.post(`${API_URL}/questions`, { data: { lessonId, body } });

test.describe('notes and Q&A API', () => {
  test('notes: free preview allowed, paid lesson needs access, private to the writer', async () => {
    const api = await request.newContext();
    await newStudent(api);

    expect((await note(api, { lessonId: SEED.hsk1PaidLesson, body: 'x' })).status()).toBe(403);
    expect((await note(api, { lessonId: SEED.hsk1FreeLesson, body: '   ' })).status()).toBe(400);
    expect((await note(api, { lessonId: SEED.hsk1FreeLesson, body: 'x', videoSeconds: -1 })).status()).toBe(400);

    const res = await note(api, { lessonId: SEED.hsk1FreeLesson, body: '  nǐ hǎo = xin chào  ', videoSeconds: 42 });
    expect(res.status(), await res.text()).toBe(201);
    const mine = await res.json();
    expect(mine).toMatchObject({ body: 'nǐ hǎo = xin chào', videoSeconds: 42, lessonId: SEED.hsk1FreeLesson });

    // Someone else never sees or touches it.
    const other = await request.newContext();
    await newStudent(other);
    expect(await (await other.get(`${API_URL}/notes/lessons/${SEED.hsk1FreeLesson}`)).json()).toEqual([]);
    expect((await other.patch(`${API_URL}/notes/${mine.id}`, { data: { body: 'hack' } })).status()).toBe(404);
    expect((await other.delete(`${API_URL}/notes/${mine.id}`)).status()).toBe(404);
    const admin = await apiAs('admin');
    expect(await (await admin.get(`notes/lessons/${SEED.hsk1FreeLesson}`)).json()).toEqual([]);

    // The writer edits and deletes it.
    expect(await (await api.patch(`${API_URL}/notes/${mine.id}`, { data: { body: 'sửa' } })).json()).toMatchObject({
      body: 'sửa',
      videoSeconds: 42,
    });
    expect((await api.delete(`${API_URL}/notes/${mine.id}`)).status()).toBe(200);
    expect(await (await api.get(`${API_URL}/notes/lessons/${SEED.hsk1FreeLesson}`)).json()).toEqual([]);

    // Logged out → 401.
    expect((await (await request.newContext()).get(`${API_URL}/notes/lessons/${SEED.hsk1FreeLesson}`)).status()).toBe(401);
  });

  test('Q&A: course access to ask, the course teacher or an admin answers', async () => {
    const teacher = await apiAs('teacher');
    const { courseId, lessonId } = await createPaidCourse(teacher);

    const asker = await request.newContext();
    const askerUser = await newStudent(asker);
    const classmate = await request.newContext();
    const classmateUser = await newStudent(classmate);
    const outsider = await request.newContext();
    await newStudent(outsider);

    // No access yet → cannot read or ask.
    expect((await ask(asker, lessonId, 'Câu hỏi?')).status()).toBe(403);
    expect((await asker.get(`${API_URL}/questions/lessons/${lessonId}`)).status()).toBe(403);

    await setAccess(teacher, courseId, askerUser.id, true);
    await setAccess(teacher, courseId, classmateUser.id, true);

    const res = await ask(asker, lessonId, 'Thanh 3 đọc thế nào ạ?');
    expect(res.status(), await res.text()).toBe(201);
    const { id: questionId } = await res.json();

    // Learners cannot answer; the course teacher and an admin can.
    expect((await asker.post(`${API_URL}/questions/${questionId}/answers`, { data: { body: 'tự trả lời' } })).status()).toBe(403);
    expect((await teacher.post(`questions/${questionId}/answers`, { data: { body: 'Xuống rồi lên.' } })).status()).toBe(201);
    const admin = await apiAs('admin');
    expect((await admin.post(`questions/${questionId}/answers`, { data: { body: 'Bổ sung.' } })).status()).toBe(201);

    // A classmate with access reads it all, but cannot delete it.
    const list = await (await classmate.get(`${API_URL}/questions/lessons/${lessonId}`)).json();
    expect(list.canAnswer).toBe(false);
    expect(list.questions).toHaveLength(1);
    expect(list.questions[0]).toMatchObject({ body: 'Thanh 3 đọc thế nào ạ?', mine: false, canDelete: false });
    expect(list.questions[0].answers.map((a: { author: { role: string } }) => a.author.role)).toEqual(['TEACHER', 'ADMIN']);
    expect((await classmate.delete(`${API_URL}/questions/${questionId}`)).status()).toBe(403);

    // Outsiders still see nothing.
    expect((await outsider.get(`${API_URL}/questions/lessons/${lessonId}`)).status()).toBe(403);

    // The teacher sees the answer box; the asker can withdraw the question.
    expect((await (await teacher.get(`questions/lessons/${lessonId}`)).json()).canAnswer).toBe(true);
    expect((await asker.delete(`${API_URL}/questions/${questionId}`)).status()).toBe(200);
    expect((await (await asker.get(`${API_URL}/questions/lessons/${lessonId}`)).json()).questions).toEqual([]);
  });
});

test.describe('notes and Q&A in the player', () => {
  test('a learner pins a note to the video and asks; the teacher answers in the player', async ({ page, browser, baseURL }) => {
    test.slow();
    const teacher = await apiAs('teacher');
    const { courseId, lessonId } = await createPaidCourse(teacher);
    const student = await newStudent(page.request);
    await setAccess(teacher, courseId, student.id, true);

    await page.goto(`/learn/${courseId}/${lessonId}`);
    await page.getByRole('tab', { name: 'Ghi chú' }).click();
    await page.getByLabel('Ghi chú mới').fill('Nhớ luyện thanh 3');
    await expect(page.getByRole('checkbox', { name: 'Gắn mốc thời gian đang xem' })).toBeChecked();
    await page.getByRole('button', { name: 'Lưu ghi chú' }).click();
    const notes = page.getByRole('list', { name: 'Ghi chú của bạn' });
    await expect(notes.getByText('Nhớ luyện thanh 3')).toBeVisible();
    await expect(notes.getByRole('button', { name: /Tua video tới 0:00/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Hỏi đáp' }).click();
    await page.getByLabel('Đặt câu hỏi').fill('Bài này có bài tập không ạ?');
    await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await expect(page.getByRole('list', { name: 'Câu hỏi về bài học' }).getByText('Bài này có bài tập không ạ?')).toBeVisible();

    // The course teacher answers from the same player.
    const teacherCtx = await browser.newContext({ storageState: storageStateFor('teacher'), baseURL });
    const tp = await teacherCtx.newPage();
    await tp.goto(`/learn/${courseId}/${lessonId}`);
    await tp.getByRole('tab', { name: 'Hỏi đáp' }).click();
    await tp.getByLabel('Trả lời', { exact: true }).fill('Có, ở tài liệu đính kèm.');
    await tp.getByRole('button', { name: 'Gửi trả lời' }).click();
    await expect(tp.getByText('Có, ở tài liệu đính kèm.')).toBeVisible();
    // The teacher's own notes list is separate and empty.
    await tp.getByRole('tab', { name: 'Ghi chú' }).click();
    await expect(tp.getByText('Bạn chưa có ghi chú nào cho bài này.')).toBeVisible();
    await teacherCtx.close();

    await page.reload();
    await page.getByRole('tab', { name: 'Hỏi đáp' }).click();
    const answers = page.getByRole('list', { name: 'Câu trả lời' });
    await expect(answers.getByText('Có, ở tài liệu đính kèm.')).toBeVisible();
    await expect(answers.getByText('Giáo viên', { exact: true })).toBeVisible();
  });

  test('a locked lesson has no notes or Q&A tabs', async ({ page }) => {
    await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1PaidLesson}`);
    await expect(page.getByRole('heading', { name: 'Bài học này đã khoá' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: 'Ghi chú' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Hỏi đáp' })).toHaveCount(0);
  });
});
