import { BOX_DAYS, nextReview, ReviewState } from './leitner';

const now = new Date('2026-11-22T10:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
const state = (box: number): ReviewState => ({ box, dueAt: now, correctCount: 3, wrongCount: 1 });

describe('nextReview', () => {
  it('a new word remembered goes to box 2, due in 2 days', () => {
    expect(nextReview(null, 'remembered', now)).toEqual({ box: 2, dueAt: days(2), correctCount: 1, wrongCount: 0 });
  });

  it.each([1, 2, 3, 4])('remembered from box %i moves up one box', (box) => {
    const next = nextReview(state(box), 'remembered', now);
    expect(next.box).toBe(box + 1);
    expect(next.dueAt).toEqual(days(BOX_DAYS[box + 1]));
    expect(next.correctCount).toBe(4);
  });

  it('box 5 stays in box 5, due in 16 days', () => {
    expect(nextReview(state(5), 'remembered', now)).toMatchObject({ box: 5, dueAt: days(16) });
  });

  it.each(['forgot', 'quiz_wrong'] as const)('%s sends the word back to box 1, due now', (outcome) => {
    expect(nextReview(state(4), outcome, now)).toEqual({ box: 1, dueAt: now, correctCount: 3, wrongCount: 2 });
  });

  it('a right quiz answer keeps the box and the due date', () => {
    const prev = { ...state(3), dueAt: days(3) };
    expect(nextReview(prev, 'quiz_correct', now)).toEqual({ ...prev, correctCount: 4 });
  });

  it('a new word answered right in a quiz is scheduled like box 1', () => {
    expect(nextReview(null, 'quiz_correct', now)).toEqual({ box: 1, dueAt: days(1), correctCount: 1, wrongCount: 0 });
  });
});
