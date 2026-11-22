import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/types/domain.types';

/** Longest note, question or answer (also a CHECK in the schema). */
export const BODY_MAX = 2000;

/** Who manages a course's Q&A: its own teacher, or any admin. */
export function canAnswer(user: AuthUser, courseTeacherId: string | null): boolean {
  if (user.role === Role.ADMIN) return true;
  return user.role === Role.TEACHER && courseTeacherId !== null && courseTeacherId === user.id;
}

/** The asker can withdraw a question; whoever answers for the course can remove it. */
export function canRemoveQuestion(
  user: AuthUser,
  question: { user_id: string },
  courseTeacherId: string | null,
): boolean {
  return question.user_id === user.id || canAnswer(user, courseTeacherId);
}

/** An answer is removed by its author or an admin. */
export function canRemoveAnswer(user: AuthUser, answer: { user_id: string }): boolean {
  return answer.user_id === user.id || user.role === Role.ADMIN;
}

/** Body text as stored: trimmed, Windows line breaks unified. Non-strings pass through for the validator. */
export function normalizeBody(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : value;
}
