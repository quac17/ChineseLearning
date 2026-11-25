import { Page, expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { SEED, anonymousApi, apiAs } from '../fixtures/auth';
import { createPaidCourse } from '../fixtures/data';
import { newStudent } from '../fixtures/payments';

// Seed: lesson-hsk1-b1 (free) has 9 words, lesson-hsk1-b2 (paid) has 10.
// Every test uses a fresh student: review boxes are per learner.

interface Word {
  id: string;
  hanzi: string;
  pinyin: string;
  meaningVi: string;
  exampleZh: string | null;
  exampleVi: string | null;
}

test.describe('practice API', () => {
  test('decks and words follow lesson access', async () => {
    const anon = await anonymousApi();
    const decks = await (await anon.get('practice/decks')).json();
    const hsk1 = decks.courses.find((c: { courseId: string }) => c.courseId === SEED.hsk1);
    expect(hsk1.lessons.map((l: { lessonId: string }) => l.lessonId)).toEqual([SEED.hsk1FreeLesson]);

    expect((await anon.get(`practice/words?lessonId=${SEED.hsk1PaidLesson}`)).status()).toBe(403);
    expect((await anon.get('practice/words?due=true')).status()).toBe(401);
    expect((await (await anon.get(`practice/words?lessonId=${SEED.hsk1FreeLesson}`)).json()).words).toHaveLength(9);
  });

  test('Leitner: remembered moves up, forgotten is due now, locked words are refused', async () => {
    const api = await request.newContext();
    await newStudent(api);
    const words: Word[] = (await (await api.get(`${API_URL}/practice/words?lessonId=${SEED.hsk1FreeLesson}`)).json()).words;
    const [a, b, c] = words;

    const res = await api.post(`${API_URL}/practice/reviews`, {
      data: {
        results: [
          { vocabularyId: a.id, outcome: 'remembered' },
          { vocabularyId: b.id, outcome: 'forgot' },
          { vocabularyId: c.id, outcome: 'quiz_wrong' },
          { vocabularyId: c.id, outcome: 'quiz_correct' },
        ],
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const saved = Object.fromEntries((await res.json()).saved.map((s: { vocabularyId: string; box: number }) => [s.vocabularyId, s.box]));
    expect(saved).toEqual({ [a.id]: 2, [b.id]: 1, [c.id]: 1 });

    const due = (await (await api.get(`${API_URL}/practice/words?due=true`)).json()).words.map((w: Word) => w.id);
    expect(due.sort()).toEqual([b.id, c.id].sort());
    expect((await (await api.get(`${API_URL}/practice/decks`)).json()).dueCount).toBe(2);

    // Words of a paid lesson without access cannot be reviewed.
    const paidWord = (await (await (await request.newContext({ storageState: 'e2e/.auth/studentA.json' })).get(
      `${API_URL}/practice/words?lessonId=${SEED.hsk1PaidLesson}`,
    )).json()).words[0];
    const refused = await api.post(`${API_URL}/practice/reviews`, {
      data: { results: [{ vocabularyId: paidWord.id, outcome: 'remembered' }] },
    });
    expect(refused.status()).toBe(403);
    expect((await api.post(`${API_URL}/practice/reviews`, { data: { results: [{ vocabularyId: a.id, outcome: 'maybe' }] } })).status()).toBe(400);
  });

  test('manual lesson quiz is gated by lesson access and playable by authorized learners', async ({ page }) => {
    const teacher = await apiAs('teacher');
    const { lessonId } = await createPaidCourse(teacher);

    const putRes = await teacher.put(`lessons/${lessonId}/quiz`, {
      data: {
        quizMode: 'MANUAL',
        questions: [
          {
            kind: 'listen',
            prompt: 'Nghe và chọn nghĩa đúng',
            payload: {
              ttsText: '谢谢',
              options: ['cảm ơn', 'xin chào', 'tạm biệt'],
              correctIndex: 0,
            },
          },
        ],
      },
    });
    expect(putRes.status(), await putRes.text()).toBe(200);

    // Unauthorized learner cannot load the paid lesson's manual quiz.
    const anon = await anonymousApi();
    expect((await anon.get(`practice/words?lessonId=${lessonId}`)).status()).toBe(403);

    // Owner teacher can open and complete the manual listening quiz.
    const teacherCtx = await page.context().browser()!.newContext({ storageState: 'e2e/.auth/teacher.json' });
    const teacherPage = await teacherCtx.newPage();
    await teacherPage.goto(`/quiz?lesson=${lessonId}`);
    await expect(teacherPage.getByText('Dạng 5 · Nghe và chọn đáp án')).toBeVisible();
    await teacherPage.getByRole('button', { name: 'cảm ơn', exact: true }).click();
    await expect(teacherPage.getByRole('status').filter({ hasText: /Chính xác/ })).toBeVisible();
    await teacherPage.getByRole('button', { name: 'Xem kết quả' }).click();
    await expect(teacherPage.getByText('Bạn đúng 1 / 1 câu.')).toBeVisible();
    await teacherCtx.close();
  });
});

test.describe('practice in the browser', () => {
  test('flashcards: flip, answer, and the forgotten word is due today', async ({ page }) => {
    await newStudent(page.request);
    await page.goto(`/flashcards?lesson=${SEED.hsk1FreeLesson}`);
    await expect(page.getByText('1 / 9')).toBeVisible();

    await page.getByRole('button', { name: /Mặt trước/ }).click();
    await expect(page.getByRole('button', { name: /Mặt sau/ })).toBeVisible();
    await page.getByRole('button', { name: 'Chưa nhớ · ôn lại' }).click();
    for (let i = 2; i <= 9; i++) {
      await expect(page.getByText(`${i} / 9`)).toBeVisible();
      await page.getByRole('button', { name: 'Đã nhớ' }).click();
    }
    await expect(page.getByText('Bạn nhớ 8 / 9 từ.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ôn lại 1 từ' })).toBeVisible();

    await page.goto('/flashcards');
    await expect(page.getByRole('heading', { name: 'Hôm nay: 1 từ cần ôn' })).toBeVisible();
  });

  test('quiz: all five question types can be answered right', async ({ page }) => {
    await newStudent(page.request);
    const set = await (await page.request.get(`${API_URL}/practice/words?lessonId=${SEED.hsk1FreeLesson}`)).json();
    const words: Word[] = set.words;

    await page.goto(`/quiz?lesson=${SEED.hsk1FreeLesson}`);
    await expect(page.getByText(/Câu 1 \/ \d+/)).toBeVisible();
    const total = Number((await page.getByText(/Câu 1 \/ \d+/).textContent())!.match(/\/ (\d+)/)![1]);

    for (let i = 1; i <= total; i++) {
      await expect(page.getByText(`Câu ${i} / ${total}`)).toBeVisible();
      await answerRight(page, words);
      await expect(page.getByRole('status').filter({ hasText: /Chính xác/ })).toBeVisible();
      await page.getByRole('button', { name: i < total ? 'Câu tiếp' : 'Xem kết quả' }).click();
    }
    await expect(page.getByText(`Bạn đúng ${total} / ${total} câu.`)).toBeVisible();
  });

  test('writing: lists the lesson characters and walks through them', async ({ page }) => {
    await page.goto(`/writing?lesson=${SEED.hsk1FreeLesson}`);
    await expect(page.getByRole('heading', { name: 'Viết theo nét' })).toBeVisible();
    await expect(page.getByText(/Chữ 1 \/ \d+/)).toBeVisible();
    await expect(page.getByRole('img', { name: /Ô 田字格 để viết chữ 你/ })).toBeVisible();
    await page.getByRole('button', { name: 'Chữ tiếp' }).click();
    await expect(page.getByRole('img', { name: /viết chữ 好/ })).toBeVisible();
  });
});

/** Reads the current question and answers it correctly from the lesson's words. */
async function answerRight(page: Page, words: Word[]) {
  const type = (await page.getByText(/^Dạng \d/).textContent()) ?? '';

  if (type.startsWith('Dạng 1')) {
    const q = (await page.getByText(/nghĩa là gì\?/).textContent())!;
    const hanzi = q.match(/“(.+)”/)![1];
    const meaning = words.find((w) => w.hanzi === hanzi)!.meaningVi;
    await page.getByRole('button', { name: meaning, exact: true }).click();
    return;
  }

  if (type.startsWith('Dạng 2')) {
    const q = (await page.getByText(/^Xếp thành câu/).textContent())!;
    const vi = q.match(/“(.+)”/)![1];
    const word = words.find((w) => (w.exampleVi || w.meaningVi) === vi)!;
    let rest = word.exampleZh!.replace(/[，。！？、,.!?\s]/g, '');
    while (rest.length > 0) {
      // Pick the longest still-enabled piece that starts the remaining text.
      const pieces = page.locator('button[lang="zh-CN"]:not([aria-label^="Bỏ"]):enabled');
      const texts = await pieces.allTextContents();
      const next = texts.filter((t) => rest.startsWith(t)).sort((x, y) => y.length - x.length)[0];
      await pieces.nth(texts.indexOf(next)).click();
      rest = rest.slice(next.length);
    }
    await page.getByRole('button', { name: 'Kiểm tra' }).click();
    return;
  }

  if (type.startsWith('Dạng 3')) {
    const sentence = (await page.locator('p[lang="zh-CN"]').textContent())!.replace(/\s/g, '');
    const [before, after] = sentence.split('___');
    const word = words.find((w) => w.exampleZh?.replace(/\s/g, '') === `${before}${w.hanzi}${after}`)!;
    await page.getByLabel('Từ còn thiếu').fill(word.pinyin); // pinyin is accepted too
    await page.getByRole('button', { name: 'Kiểm tra' }).click();
    return;
  }

  if (type.startsWith('Dạng 5')) {
    const playBtn = page.locator('button[data-vocabulary-id]');
    const vocabId = await playBtn.getAttribute('data-vocabulary-id');
    const meaning = words.find((w) => w.id === vocabId)!.meaningVi;
    await page.getByRole('button', { name: meaning, exact: true }).click();
    return;
  }

  // Dạng 4: match each Hanzi with its meaning.
  const left = page.locator('button[lang="zh-CN"]');
  const count = await left.count();
  for (let i = 0; i < count; i++) {
    const hanzi = (await left.nth(i).textContent())!.trim();
    const meaning = words.find((w) => w.hanzi === hanzi)!.meaningVi;
    await left.nth(i).click();
    await page.getByRole('button', { name: meaning, exact: true }).click();
  }
}
