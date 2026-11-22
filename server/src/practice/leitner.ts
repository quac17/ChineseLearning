/**
 * Leitner boxes for vocabulary review (agreed design, phase 2c).
 *
 * Box 1–5 waits 1, 2, 4, 8, 16 days. "Đã nhớ" on a flashcard moves a word up
 * one box; "Chưa nhớ" or a wrong quiz answer sends it back to box 1, due
 * immediately so it comes back in the same day's review. A right quiz answer
 * keeps the box (the flashcard decides promotion) but counts as correct.
 */
export type ReviewOutcome = 'remembered' | 'forgot' | 'quiz_correct' | 'quiz_wrong';

export const BOX_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

export interface ReviewState {
  box: number;
  dueAt: Date;
  correctCount: number;
  wrongCount: number;
}

const DAY_MS = 86_400_000;

export function nextReview(prev: ReviewState | null, outcome: ReviewOutcome, now: Date): ReviewState {
  const base: ReviewState = prev ?? { box: 1, dueAt: now, correctCount: 0, wrongCount: 0 };
  switch (outcome) {
    case 'remembered': {
      const box = Math.min(5, base.box + 1);
      return { box, dueAt: new Date(now.getTime() + BOX_DAYS[box] * DAY_MS), correctCount: base.correctCount + 1, wrongCount: base.wrongCount };
    }
    case 'forgot':
    case 'quiz_wrong':
      return { box: 1, dueAt: now, correctCount: base.correctCount, wrongCount: base.wrongCount + 1 };
    case 'quiz_correct':
      return {
        box: base.box,
        // A word met for the first time in a quiz is scheduled like box 1.
        dueAt: prev ? base.dueAt : new Date(now.getTime() + BOX_DAYS[1] * DAY_MS),
        correctCount: base.correctCount + 1,
        wrongCount: base.wrongCount,
      };
  }
}
