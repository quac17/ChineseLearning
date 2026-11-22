import { APIRequestContext, expect, test } from '@playwright/test';
import { SEED, anonymousApi, apiAs, storageStateFor } from '../fixtures/auth';
import { uniq } from '../fixtures/data';

interface Outline {
  sections: Array<{ id: string; title: string; sortOrder: number; lessonIds: string[] }>;
  lessons: Array<{ id: string; title: string; sectionId: string | null }>;
}

async function createCourseWithLessons(teacher: APIRequestContext, count: number) {
  const tag = uniq();
  const course = await (
    await teacher.post('courses', { data: { title: `E2E khoá có phần ${tag}`, module: 'hsk', isFree: true } })
  ).json();
  const lessonIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const res = await teacher.post('lessons/youtube', {
      data: { courseId: course.id, title: `Bài ${i + 1} ${tag}`, youtubeUrl: 'dQw4w9WgXcQ', isFree: true },
    });
    expect(res.status(), await res.text()).toBe(201);
    lessonIds.push((await res.json()).id);
  }
  return { courseId: course.id as string, lessonIds };
}

test.describe('course sections API', () => {
  test('seed HSK 1 comes back grouped by section, free/paid lessons unchanged', async () => {
    const anon = await anonymousApi();
    const course: Outline = await (await anon.get(`courses/${SEED.hsk1}`)).json();
    expect(course.sections.map((s) => [s.title, s.lessonIds])).toEqual([
      ['Phát âm và chào hỏi', [SEED.hsk1FreeLesson]],
      ['Giới thiệu bản thân', [SEED.hsk1PaidLesson]],
    ]);
    expect(course.lessons.map((l) => l.id)).toEqual([SEED.hsk1FreeLesson, SEED.hsk1PaidLesson]);
  });

  test('a course without sections still lists its lessons flat', async () => {
    const course: Outline = await (await (await anonymousApi()).get('courses/course-easy1')).json();
    expect(course.sections).toEqual([]);
    expect(course.lessons.length).toBeGreaterThan(0);
    expect(course.lessons.every((l) => l.sectionId === null)).toBe(true);
  });

  test('teacher creates, renames, reorders sections and assigns lessons', async () => {
    const teacher = await apiAs('teacher');
    const { courseId, lessonIds } = await createCourseWithLessons(teacher, 3);
    const [a, b, c] = lessonIds;

    const s1 = await (await teacher.post(`courses/${courseId}/sections`, { data: { title: 'Mở đầu' } })).json();
    const s2res = await teacher.post(`courses/${courseId}/sections`, { data: { title: '  Luyện tập  ' } });
    expect(s2res.status()).toBe(201);
    const s2 = await s2res.json();
    expect([s1.sortOrder, s2.sortOrder, s2.title]).toEqual([0, 1, 'Luyện tập']);

    // a, b → s2; c → s1. Display order: s1 (c), s2 (a, b).
    for (const [lesson, section] of [[a, s2.id], [b, s2.id], [c, s1.id]]) {
      const res = await teacher.patch(`lessons/${lesson}`, { data: { sectionId: section } });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    let outline: Outline = await (await teacher.get(`courses/${courseId}`)).json();
    expect(outline.lessons.map((l) => l.id)).toEqual([c, a, b]);

    // Reorder sections and rename one.
    const reordered = await teacher.patch(`courses/${courseId}/sections/reorder`, { data: { orderedIds: [s2.id, s1.id] } });
    expect(reordered.ok(), await reordered.text()).toBeTruthy();
    expect((await teacher.patch(`courses/${courseId}/sections/${s1.id}`, { data: { title: 'Ôn tập' } })).ok()).toBeTruthy();
    outline = await (await teacher.get(`courses/${courseId}`)).json();
    expect(outline.sections.map((s) => s.title)).toEqual(['Luyện tập', 'Ôn tập']);
    expect(outline.lessons.map((l) => l.id)).toEqual([a, b, c]);

    // Lesson order inside a section follows PATCH /lessons/reorder.
    expect((await teacher.patch('lessons/reorder', { data: { courseId, orderedIds: [b, a, c] } })).ok()).toBeTruthy();
    outline = await (await teacher.get(`courses/${courseId}`)).json();
    expect(outline.sections[0].lessonIds).toEqual([b, a]);

    // Unassign one lesson: it moves after every section.
    expect((await teacher.patch(`lessons/${b}`, { data: { sectionId: null } })).ok()).toBeTruthy();
    outline = await (await teacher.get(`courses/${courseId}`)).json();
    expect(outline.lessons.map((l) => l.id)).toEqual([a, c, b]);

    // Deleting a section keeps its lessons in the course, without a section.
    expect((await teacher.delete(`courses/${courseId}/sections/${s2.id}`)).ok()).toBeTruthy();
    outline = await (await teacher.get(`courses/${courseId}`)).json();
    expect(outline.sections.map((s) => s.id)).toEqual([s1.id]);
    expect(outline.lessons.find((l) => l.id === a)?.sectionId).toBeNull();
  });

  test('rejects bad input with Vietnamese messages', async () => {
    const teacher = await apiAs('teacher');
    const one = await createCourseWithLessons(teacher, 1);
    const two = await createCourseWithLessons(teacher, 1);
    const s1 = await (await teacher.post(`courses/${one.courseId}/sections`, { data: { title: 'Phần A' } })).json();
    await teacher.post(`courses/${one.courseId}/sections`, { data: { title: 'Phần B' } });

    const short = await teacher.post(`courses/${one.courseId}/sections`, { data: { title: ' x ' } });
    expect(short.status()).toBe(400);
    expect(JSON.stringify(await short.json())).toContain('Tên phần tối thiểu 2 ký tự');

    // A lesson cannot join a section of another course.
    const cross = await teacher.patch(`lessons/${two.lessonIds[0]}`, { data: { sectionId: s1.id } });
    expect(cross.status()).toBe(400);
    expect((await cross.json()).message).toBe('Phần này không thuộc khoá học của bài giảng.');

    // Reorder must list every section exactly once.
    const partial = await teacher.patch(`courses/${one.courseId}/sections/reorder`, { data: { orderedIds: [s1.id] } });
    expect(partial.status()).toBe(400);

    const missing = await teacher.patch(`courses/${one.courseId}/sections/section-nope`, { data: { title: 'Đổi tên' } });
    expect(missing.status()).toBe(404);
  });

  test('only the owner teacher or an admin may change sections', async () => {
    const teacher = await apiAs('teacher');
    const { courseId } = await createCourseWithLessons(teacher, 1);
    const anon = await anonymousApi();
    const studentA = await apiAs('studentA');
    expect((await anon.post(`courses/${courseId}/sections`, { data: { title: 'Phần X' } })).status()).toBe(401);
    expect((await studentA.post(`courses/${courseId}/sections`, { data: { title: 'Phần X' } })).status()).toBe(403);
    expect((await (await apiAs('admin')).post(`courses/${courseId}/sections`, { data: { title: 'Phần X' } })).status()).toBe(201);
  });
});

test.describe('sections in the learner pages', () => {
  test('course page shows one accordion per section, the first one open', async ({ page }) => {
    await page.goto(`/courses/${SEED.hsk1}`);
    const curriculum = page.getByRole('region', { name: 'Nội dung khoá học' });
    await expect(curriculum.getByText('2 phần · 2 bài')).toBeVisible();
    const first = curriculum.locator('details', { hasText: 'Phần 1: Phát âm và chào hỏi' });
    const second = curriculum.locator('details', { hasText: 'Phần 2: Giới thiệu bản thân' });
    await expect(first).toHaveAttribute('open', '');
    await expect(first.getByRole('link', { name: 'Xem thử' })).toBeVisible();
    await expect(second).not.toHaveAttribute('open', '');
    await second.getByText('Phần 2: Giới thiệu bản thân').click();
    await expect(second.getByText(/2\. HSK 1 – Bài 2/)).toBeVisible();
  });

  test('a course without sections keeps the flat list', async ({ page }) => {
    await page.goto('/courses/course-easy1');
    const curriculum = page.getByRole('region', { name: 'Nội dung khoá học' });
    await expect(curriculum.getByText(/Easy Steps – Bài 1/)).toBeVisible();
    await expect(curriculum.locator('details')).toHaveCount(0);
  });

  test.describe('as studentA', () => {
    test.use({ storageState: storageStateFor('studentA') });

    test('player lists lessons under section headings with x / n bài', async ({ page }) => {
      await page.goto(`/learn/${SEED.hsk1}/${SEED.hsk1PaidLesson}`);
      const side = page.getByRole('complementary', { name: 'Nội dung khoá học' });
      const part1 = side.getByRole('region', { name: /Phần 1: Phát âm và chào hỏi/ });
      const part2 = side.getByRole('region', { name: /Phần 2: Giới thiệu bản thân/ });
      await expect(part1.getByText(/\d \/ 1 bài/)).toBeVisible();
      await expect(part2.getByRole('link', { name: /2\. HSK 1 – Bài 2/ })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByText('Phần 2: Giới thiệu bản thân').first()).toBeVisible();
    });
  });
});
