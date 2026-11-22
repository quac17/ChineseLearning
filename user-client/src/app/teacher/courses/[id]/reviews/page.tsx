'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, EmptyState, Field, Skeleton, Textarea, useToast } from '@/components/ui';
import { ReviewItem, ReviewSummaryBlock } from '@/components/course/Reviews';
import rs from '@/components/course/reviews.module.css';
import { apiRequest } from '@/lib/api';
import { REVIEW_TEXT_MAX } from '@/lib/courses';
import type { ManagedReview, ManagedReviewPage } from '@/lib/types';
import s from '../../../teacher.module.css';
import { useEditorCourse } from '../editor';

/**
 * "Đánh giá" tab: every review of the course (hidden ones marked), newest
 * unanswered first, with a reply box. Only admins hide reviews (/admin/reviews).
 */
export default function CourseReviewsTab() {
  const { course } = useEditorCourse();
  const [data, setData] = useState<ManagedReviewPage | null>(null);
  const [items, setItems] = useState<ManagedReview[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const first = await apiRequest<ManagedReviewPage>(`/courses/${encodeURIComponent(course.id)}/reviews/manage`);
      setData(first);
      setItems(first.items);
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được đánh giá.');
    }
  }, [course.id]);

  useEffect(() => {
    load();
  }, [load]);

  const more = async () => {
    if (!data) return;
    try {
      const next = await apiRequest<ManagedReviewPage>(
        `/courses/${encodeURIComponent(course.id)}/reviews/manage?page=${data.page + 1}`,
      );
      setData(next);
      setItems((list) => [...list, ...next.items.filter((r) => !list.some((x) => x.id === r.id))]);
    } catch (err) {
      setError((err as Error).message || 'Không tải được đánh giá.');
    }
  };

  const replace = (review: ManagedReview) => setItems((list) => list.map((r) => (r.id === review.id ? review : r)));

  return (
    <section className={s.card} aria-labelledby="reviews-title">
      <div className={s.cardHead}>
        <h2 id="reviews-title" className={s.cardTitle}>
          Đánh giá của học viên ({data?.total ?? 0})
        </h2>
        {data && data.unanswered > 0 && <Badge tone="warning">{data.unanswered} chưa trả lời</Badge>}
      </div>
      <div className={s.pad}>
        {course.isFree ? (
          <EmptyState title="Khoá học miễn phí không nhận đánh giá">
            Chỉ học viên đã mua khoá học trả phí mới đánh giá được.
          </EmptyState>
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : !data ? (
          <Skeleton height={160} />
        ) : items.length === 0 ? (
          <EmptyState title="Chưa có đánh giá">
            Học viên đã mua khoá học sẽ chấm sao và nhận xét trên trang khoá học. Bạn trả lời ngay tại đây.
          </EmptyState>
        ) : (
          <div className={s.stack}>
            <ReviewSummaryBlock summary={data.summary} />
            <ul className={rs.list} aria-label="Đánh giá">
              {items.map((r) => (
                <ManagedRow key={r.id} review={r} onChange={replace} />
              ))}
            </ul>
            {items.length < data.total && (
              <Button variant="outline" size="sm" className={rs.more} onClick={more}>
                Xem thêm
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ManagedRow({ review, onChange }: { review: ManagedReview; onChange: (r: ManagedReview) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(review.reply?.body ?? '');
  const [busy, setBusy] = useState(false);

  const send = async (method: 'PUT' | 'DELETE') => {
    setBusy(true);
    try {
      const next = await apiRequest<ManagedReview>(`/reviews/${encodeURIComponent(review.id)}/reply`, {
        method,
        body: method === 'PUT' ? JSON.stringify({ body }) : undefined,
      });
      onChange(next);
      setBody(next.reply?.body ?? '');
      setOpen(false);
      toast.show(method === 'PUT' ? 'Đã gửi câu trả lời' : 'Đã xoá câu trả lời');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ReviewItem
      review={review}
      name={review.studentName}
      badges={review.isHidden ? <Badge tone="error">Đã ẩn: {review.hiddenReason}</Badge> : null}
    >
      {open ? (
        <div className={rs.form}>
          <Field label="Câu trả lời của giáo viên" hint="Hiện công khai ngay dưới đánh giá.">
            <Textarea rows={3} maxLength={REVIEW_TEXT_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <div className={rs.formRow}>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button variant="ink" size="sm" loading={busy} disabled={!body.trim()} onClick={() => send('PUT')}>
              Gửi trả lời
            </Button>
          </div>
        </div>
      ) : (
        <div className={rs.actions}>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {review.reply ? 'Sửa trả lời' : 'Trả lời'}
          </Button>
          {review.reply && (
            <Button variant="text" size="sm" loading={busy} onClick={() => send('DELETE')}>
              Xoá trả lời
            </Button>
          )}
        </div>
      )}
    </ReviewItem>
  );
}
