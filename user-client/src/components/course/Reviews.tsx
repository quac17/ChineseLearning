'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Button, Dialog, Field, Skeleton, Textarea, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { REVIEWS_MIN_TO_SHOW, REVIEW_TEXT_MAX, formatAverage, routes } from '@/lib/courses';
import type { CourseItem, MyReviewState, OwnReview, PublicReview, PublicReviewPage, ReviewSummary } from '@/lib/types';
import s from './reviews.module.css';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** ★★★★☆ with a readable label. */
export function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className={s.stars} role="img" aria-label={`${Number.isInteger(value) ? value : formatAverage(value)} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden="true" className={i > full ? s.starOff : undefined}>
          ★
        </span>
      ))}
    </span>
  );
}

const STAR_WORDS = ['', 'Rất tệ', 'Chưa tốt', 'Tạm được', 'Tốt', 'Tuyệt vời'];

/** Five radios drawn as stars (arrow keys move between them). */
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <fieldset className={s.picker}>
      <legend className={s.pickerLegend}>Số sao</legend>
      <div className={s.pickerRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i} className={`${s.pickerStar} ${i <= value ? s.on : ''}`}>
            <input type="radio" name="review-stars" value={i} checked={value === i} onChange={() => onChange(i)} />
            <span aria-hidden="true">★</span>
            <span className="sr-only">{i} sao</span>
          </label>
        ))}
        <span className={s.pickerHint} aria-live="polite">
          {value ? STAR_WORDS[value] : 'Chọn từ 1 đến 5 sao'}
        </span>
      </div>
    </fieldset>
  );
}

/** Average + stars + count, or a note while there are fewer than REVIEWS_MIN_TO_SHOW. */
export function ReviewSummaryBlock({ summary }: { summary: ReviewSummary }) {
  if (summary.average == null) {
    return (
      <p className={s.muted}>
        {summary.count > 0
          ? `${summary.count} đánh giá. Điểm trung bình hiện khi có từ ${REVIEWS_MIN_TO_SHOW} đánh giá.`
          : 'Chưa có đánh giá nào.'}
      </p>
    );
  }
  return (
    <div className={s.summary} data-testid="review-summary">
      <span className={s.average}>{formatAverage(summary.average)}</span>
      <span className={s.summaryText}>
        <Stars value={summary.average} />
        <span>{summary.count} đánh giá của học viên đã mua</span>
      </span>
    </div>
  );
}

/** One review: stars, name, date, comment and the teacher's reply. */
export function ReviewItem({
  review,
  name,
  badges,
  children,
}: {
  review: PublicReview;
  /** Defaults to the shortened public name. */
  name?: string;
  badges?: ReactNode;
  children?: ReactNode;
}) {
  const edited = review.updatedAt && new Date(review.updatedAt).getTime() - new Date(review.createdAt).getTime() > 60_000;
  return (
    <li className={s.item}>
      <div className={s.meta}>
        <Stars value={review.stars} />
        <b className={s.author}>{name ?? review.authorName}</b>
        <span>{formatDate(review.createdAt)}</span>
        {edited && <span>· đã sửa</span>}
        {badges}
      </div>
      {review.comment && <p className={s.comment}>{review.comment}</p>}
      {review.reply && (
        <div className={s.reply}>
          <span className={s.replyHead}>
            Giáo viên trả lời <span>· {formatDate(review.reply.repliedAt)}</span>
          </span>
          <p className={s.comment}>{review.reply.body}</p>
        </div>
      )}
      {children}
    </li>
  );
}

/**
 * "Đánh giá của học viên" on the course page (paid courses only): the real
 * average once there are enough reviews, the learner's own review or form,
 * and the visible reviews, newest first. The sourced survey rating in the
 * hero is a separate number and is never mixed in here.
 */
export function CourseReviews({ course, onSummary }: { course: CourseItem; onSummary: (s: ReviewSummary) => void }) {
  const { user } = useAuth();
  const [page, setPage] = useState<PublicReviewPage | null>(null);
  const [items, setItems] = useState<PublicReview[]>([]);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const first = await apiRequest<PublicReviewPage>(`/courses/${encodeURIComponent(course.id)}/reviews`);
      setPage(first);
      setItems(first.items);
      setError('');
      onSummary(first.summary);
    } catch (err) {
      setError((err as Error).message || 'Không tải được đánh giá.');
    }
  }, [course.id, onSummary]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!page) return;
    setLoadingMore(true);
    try {
      const next = await apiRequest<PublicReviewPage>(`/courses/${encodeURIComponent(course.id)}/reviews?page=${page.page + 1}`);
      setPage(next);
      setItems((list) => [...list, ...next.items.filter((r) => !list.some((x) => x.id === r.id))]);
    } catch (err) {
      setError((err as Error).message || 'Không tải được đánh giá.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      {error ? <Alert tone="error">{error}</Alert> : page ? <ReviewSummaryBlock summary={page.summary} /> : <Skeleton height={48} />}
      {user ? (
        <MyReview courseId={course.id} onChange={load} />
      ) : (
        <p className={s.muted}>
          Đã mua khoá học? <Link href={routes.login(routes.course(course.id))}>Đăng nhập</Link> để đánh giá.
        </p>
      )}
      {page && items.length > 0 && (
        <ul className={s.list} aria-label="Đánh giá của học viên">
          {items.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </ul>
      )}
      {page && items.length < page.total && (
        <Button variant="outline" size="sm" className={s.more} onClick={loadMore} loading={loadingMore}>
          Xem thêm đánh giá
        </Button>
      )}
    </>
  );
}

/** The logged-in learner's own review: form when allowed, moderation state when hidden. */
function MyReview({ courseId, onChange }: { courseId: string; onChange: () => Promise<void> }) {
  const toast = useToast();
  const [state, setState] = useState<MyReviewState | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await apiRequest<MyReviewState>(`/courses/${encodeURIComponent(courseId)}/reviews/mine`));
    } catch {
      setState(null);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!state) return null;
  const { review, canReview } = state;
  // Not a buyer and nothing written: the list alone is enough.
  if (!review && !canReview) return null;

  const remove = async () => {
    setBusy(true);
    try {
      await apiRequest(`/courses/${encodeURIComponent(courseId)}/reviews/mine`, { method: 'DELETE' });
      toast.show('Đã xoá đánh giá của bạn');
      setConfirmDelete(false);
      await Promise.all([load(), onChange()]);
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!review || editing) {
    return (
      <ReviewForm
        courseId={courseId}
        initial={review}
        onCancel={review ? () => setEditing(false) : undefined}
        onSaved={async (next) => {
          setState(next);
          setEditing(false);
          await onChange();
        }}
      />
    );
  }

  return (
    <section className={s.mine} aria-labelledby="my-review-title">
      <h3 id="my-review-title" className={s.mineTitle}>
        Đánh giá của bạn
      </h3>
      {review.isHidden && (
        <Alert tone="warning" title="Đánh giá đang bị ẩn.">
          Quản trị viên đã ẩn đánh giá này{review.hiddenReason ? `: ${review.hiddenReason}` : ''}. Chỉ bạn còn thấy nó, và nó
          không được tính vào điểm trung bình.
        </Alert>
      )}
      <ul className={s.list}>
        <ReviewItem review={review} name="Bạn" />
      </ul>
      {!canReview && <p className={s.muted}>Bạn không còn quyền xem khoá học nên không sửa được đánh giá, nhưng vẫn có thể xoá.</p>}
      <div className={s.actions}>
        {canReview && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Sửa đánh giá
          </Button>
        )}
        <Button variant="text" size="sm" onClick={() => setConfirmDelete(true)}>
          Xoá đánh giá
        </Button>
      </div>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Xoá đánh giá của bạn?"
        actions={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Giữ lại
            </Button>
            <Button variant="ink" onClick={remove} loading={busy}>
              Xoá
            </Button>
          </>
        }
      >
        <p>Đánh giá và câu trả lời của giáo viên (nếu có) sẽ bị xoá. Bạn có thể viết lại sau.</p>
      </Dialog>
    </section>
  );
}

function ReviewForm({
  courseId,
  initial,
  onSaved,
  onCancel,
}: {
  courseId: string;
  initial: OwnReview | null;
  onSaved: (state: MyReviewState) => Promise<void>;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stars) return;
    setBusy(true);
    try {
      const next = await apiRequest<MyReviewState>(`/courses/${encodeURIComponent(courseId)}/reviews/mine`, {
        method: 'PUT',
        body: JSON.stringify({ stars, comment: comment.trim() || null }),
      });
      toast.show(initial ? 'Đã lưu đánh giá' : 'Cảm ơn bạn đã đánh giá');
      await onSaved(next);
    } catch (err) {
      toast.show((err as Error).message || 'Không gửi được đánh giá.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${s.mine} ${s.form}`} onSubmit={submit} aria-label="Đánh giá khoá học">
      <h3 className={s.mineTitle}>{initial ? 'Sửa đánh giá của bạn' : 'Bạn thấy khoá học thế nào?'}</h3>
      <StarPicker value={stars} onChange={setStars} />
      <Field label="Nhận xét (không bắt buộc)" hint={`Điều bạn thích hoặc cần cải thiện. Tối đa ${REVIEW_TEXT_MAX} ký tự.`}>
        <Textarea rows={3} maxLength={REVIEW_TEXT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <div className={s.formRow}>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Huỷ
          </Button>
        )}
        <Button type="submit" variant="ink" size="sm" loading={busy} disabled={!stars}>
          {initial ? 'Lưu đánh giá' : 'Gửi đánh giá'}
        </Button>
      </div>
    </form>
  );
}

/** Small hero line: "4,7 ★ · 12 đánh giá của học viên" (only from the threshold on). */
export function HeroReviews({ summary }: { summary: ReviewSummary | undefined }) {
  if (!summary || summary.average == null) return null;
  return (
    <a href="#danh-gia" data-testid="hero-reviews">
      {formatAverage(summary.average)} <span aria-hidden="true">★</span>
      <span className="sr-only"> trên 5 sao</span> · {summary.count} đánh giá của học viên
    </a>
  );
}
