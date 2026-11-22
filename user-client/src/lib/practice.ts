import { apiRequest } from './api';
import type { ProgramModule } from './types';

/** GET /practice/decks */
export interface PracticeDecks {
  dueCount: number;
  courses: Array<{
    courseId: string;
    courseTitle: string;
    module: ProgramModule;
    lessons: Array<{ lessonId: string; title: string; wordCount: number; dueCount: number }>;
  }>;
}

export interface PracticeWord {
  id: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  hanzi: string;
  pinyin: string;
  meaningVi: string;
  exampleZh: string | null;
  exampleVi: string | null;
  box: number | null;
  dueAt: string | null;
}

/** GET /practice/words: the session's words plus other words of the course (quiz distractors). */
export interface PracticeSet {
  title: string;
  words: PracticeWord[];
  pool: Array<{ id: string; hanzi: string; pinyin: string; meaningVi: string }>;
}

export type ReviewOutcome = 'remembered' | 'forgot' | 'quiz_correct' | 'quiz_wrong';

export type PracticeSource = { lessonId: string } | { due: true };

export function practiceQuery(src: PracticeSource): string {
  return 'due' in src ? 'due=true' : `lesson=${encodeURIComponent(src.lessonId)}`;
}

export function loadPracticeSet(src: PracticeSource) {
  const qs = 'due' in src ? 'due=true' : `lessonId=${encodeURIComponent(src.lessonId)}`;
  return apiRequest<PracticeSet>(`/practice/words?${qs}`);
}

/** Saves results for a logged-in learner; a no-op (resolved) when logged out. */
export async function saveReviews(
  loggedIn: boolean,
  results: Array<{ vocabularyId: string; outcome: ReviewOutcome }>,
): Promise<void> {
  if (!loggedIn || results.length === 0) return;
  await apiRequest('/practice/reviews', { method: 'POST', body: JSON.stringify({ results }) });
}

export const practiceRoutes = {
  hub: '/flashcards',
  flashcards: (src: PracticeSource) => `/flashcards?${practiceQuery(src)}`,
  quiz: (src: PracticeSource) => `/quiz?${practiceQuery(src)}`,
  writing: (src: PracticeSource) => `/writing?${practiceQuery(src)}`,
};

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "Nǐ hǎo" / "ni3 hao3" / "nihao" all compare equal: strip tones, digits, spaces. */
export function looseAnswer(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ü/g, 'u')
    .replace(/[0-9\s'’·.,，。!?！？]/g, '')
    .toLowerCase();
}
