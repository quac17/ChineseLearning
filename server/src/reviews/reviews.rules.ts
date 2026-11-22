import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/types/domain.types';

/**
 * Real course reviews (#41, docs/design/DECISIONS.md). Pure rules, tested in
 * reviews.rules.spec.ts; the service only feeds them rows.
 */

/** The course page shows the average only from this many visible reviews on. */
export const REVIEWS_MIN_TO_SHOW = 3;
/** Longest review comment and teacher reply (also CHECKs in the schema). */
export const REVIEW_TEXT_MAX = 1000;
export const HIDE_REASON_MIN = 5;
export const HIDE_REASON_MAX = 300;
export const REVIEWS_PAGE_SIZE = 10;

export type Eligibility = { ok: true } | { ok: false; reason: string };

/**
 * Who may write, edit or keep editing a review: a STUDENT with an open
 * enrollment (`can_view`) on a paid course. Watching lessons is not required
 * (YouTube lessons only record progress on a manual tick).
 */
export function reviewEligibility(input: {
  user: Pick<AuthUser, 'role'> | null;
  course: { is_free: boolean } | null;
  canView: boolean;
}): Eligibility {
  if (!input.course) return { ok: false, reason: 'Không tìm thấy khóa học.' };
  if (!input.user) return { ok: false, reason: 'Đăng nhập để đánh giá khoá học.' };
  if (input.user.role !== Role.STUDENT) {
    return { ok: false, reason: 'Chỉ học viên đã mua khoá học mới đánh giá được.' };
  }
  if (input.course.is_free) return { ok: false, reason: 'Khoá học miễn phí không nhận đánh giá.' };
  if (!input.canView) return { ok: false, reason: 'Chỉ học viên đã mua khoá học mới đánh giá được.' };
  return { ok: true };
}

/**
 * `{ average, count }` for the course API from the visible reviews. The
 * average stays null below REVIEWS_MIN_TO_SHOW so no client can show a
 * score built on one or two opinions.
 */
export function reviewSummary(count: number, rawAverage: number | string | null): { average: number | null; count: number } {
  const n = Number(count) || 0;
  if (n < REVIEWS_MIN_TO_SHOW || rawAverage == null) return { average: null, count: n };
  return { average: Math.round(Number(rawAverage) * 10) / 10, count: n };
}

/** Its own teacher or any admin replies to a course's reviews. */
export function canReply(user: AuthUser, courseTeacherId: string | null): boolean {
  if (user.role === Role.ADMIN) return true;
  return user.role === Role.TEACHER && courseTeacherId !== null && courseTeacherId === user.id;
}

/**
 * Public name of a reviewer: given name in full, the rest as initials
 * ("Nguyễn Văn An" → "N. V. An"). Parenthesised notes are dropped.
 */
export function publicName(fullName: string | null | undefined): string {
  const words = (fullName ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'Học viên';
  const given = words[words.length - 1];
  const initials = words.slice(0, -1).map((w) => `${w.charAt(0).toUpperCase()}.`);
  return [...initials, given].join(' ');
}

/** Trimmed text with unified line breaks; blank becomes null. Non-strings pass through for the validator. */
export function normalizeText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.replace(/\r\n/g, '\n').trim();
  return text === '' ? null : text;
}
