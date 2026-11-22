/**
 * Ratings and learner counts on course pages (#29, docs/design/DECISIONS.md).
 * A rating is only ever stored together with a real, stated source; without
 * one there is no rating at all and the rating block stays hidden.
 */

export const RATING_SOURCE_MIN = 10;
export const RATING_SOURCE_MAX = 200;

export type RatingInput = { ratingValue: number | null | undefined; ratingSource: string | null | undefined };
export type RatingResult =
  | { ok: true; ratingValue: number | null; ratingSource: string | null }
  | { ok: false; message: string };

/** Both empty = clear the rating. A value without a source (or the reverse) is refused. */
export function checkRating({ ratingValue, ratingSource }: RatingInput): RatingResult {
  const source = typeof ratingSource === 'string' ? ratingSource.trim().replace(/\s+/g, ' ') : '';
  const hasValue = typeof ratingValue === 'number';
  if (!hasValue && !source) return { ok: true, ratingValue: null, ratingSource: null };
  if (!hasValue) return { ok: false, message: 'Nhập điểm đánh giá (1–5) cho nguồn này, hoặc xoá nguồn để ẩn đánh giá.' };
  if (!source) {
    return {
      ok: false,
      message: 'Điểm đánh giá phải kèm nguồn thật (ví dụ "khảo sát 120 học viên lớp offline 2025"). Không có nguồn thì để trống.',
    };
  }
  if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5 || Math.abs(Math.round(ratingValue * 10) - ratingValue * 10) > 1e-9) {
    return { ok: false, message: 'Điểm đánh giá từ 1 đến 5, tối đa một chữ số thập phân.' };
  }
  if (source.length < RATING_SOURCE_MIN) {
    return { ok: false, message: `Nguồn đánh giá tối thiểu ${RATING_SOURCE_MIN} ký tự: ghi rõ ai chấm, bao nhiêu người, khi nào.` };
  }
  if (source.length > RATING_SOURCE_MAX) {
    return { ok: false, message: `Nguồn đánh giá tối đa ${RATING_SOURCE_MAX} ký tự.` };
  }
  return { ok: true, ratingValue, ratingSource: source };
}
