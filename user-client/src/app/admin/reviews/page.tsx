'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Dialog, EmptyState, Field, Input, Skeleton, Tabs, useToast } from '@/components/ui';
import { ReviewItem } from '@/components/course/Reviews';
import rs from '@/components/course/reviews.module.css';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import type { ManagedReview, ReviewPage } from '@/lib/types';
import { AdminOnly } from '../AdminOnly';
import s from '../admin.module.css';

type Status = 'all' | 'visible' | 'hidden';
const FILTERS: Array<{ id: Status; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'visible', label: 'Đang hiện' },
  { id: 'hidden', label: 'Đã ẩn' },
];

/**
 * Admin moderation of real learner reviews (#41): hide a review that breaks
 * the rules (with a reason the author sees) or show it again. Hidden reviews
 * leave the public list and the course average at once.
 */
export default function AdminReviewsPage() {
  return (
    <AdminOnly>
      <Moderation />
    </AdminOnly>
  );
}

function Moderation() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReviewPage<ManagedReview> | null>(null);
  const [error, setError] = useState('');
  const [hiding, setHiding] = useState<ManagedReview | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<ReviewPage<ManagedReview>>(`/admin/reviews?status=${status}&page=${page}`));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được đánh giá.');
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setHidden = async (review: ManagedReview, hidden: boolean) => {
    setBusy(true);
    try {
      await apiRequest(`/admin/reviews/${encodeURIComponent(review.id)}/hidden`, {
        method: 'PATCH',
        body: JSON.stringify(hidden ? { hidden, reason } : { hidden }),
      });
      toast.show(hidden ? 'Đã ẩn đánh giá' : 'Đã hiện lại đánh giá');
      setHiding(null);
      setReason('');
      await load();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Kiểm duyệt đánh giá</h1>
          <p className={s.sub}>
            Đánh giá thật của học viên đã mua. Chỉ ẩn nội dung vi phạm (xúc phạm, quảng cáo, thông tin cá nhân), không ẩn vì
            điểm thấp. Lý do ẩn được gửi tới người viết. Đánh giá bị ẩn không tính vào điểm trung bình.
          </p>
        </div>
      </div>
      <Tabs
        items={FILTERS}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        label="Lọc đánh giá"
        variant="segmented"
      />
      <section className={`${s.card}`} style={{ padding: '4px 20px' }} aria-label="Danh sách đánh giá">
        {error ? (
          <Alert tone="error">{error}</Alert>
        ) : !data ? (
          <Skeleton height={200} />
        ) : data.items.length === 0 ? (
          <EmptyState title={status === 'hidden' ? 'Không có đánh giá bị ẩn' : 'Chưa có đánh giá'} />
        ) : (
          <ul className={rs.list}>
            {data.items.map((r) => (
              <ReviewItem
                key={r.id}
                review={r}
                name={r.studentName}
                badges={
                  <>
                    {r.course && <Link href={routes.course(r.course.id)}>{r.course.title}</Link>}
                    {r.isHidden ? <Badge tone="error">Đã ẩn</Badge> : <Badge tone="success">Đang hiện</Badge>}
                  </>
                }
              >
                {r.isHidden && r.hiddenReason && <p className={rs.muted}>Lý do ẩn: {r.hiddenReason}</p>}
                <div className={rs.actions}>
                  {r.isHidden ? (
                    <Button variant="outline" size="sm" loading={busy} onClick={() => setHidden(r, false)}>
                      Hiện lại
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReason('');
                        setHiding(r);
                      }}
                    >
                      Ẩn đánh giá
                    </Button>
                  )}
                </div>
              </ReviewItem>
            ))}
          </ul>
        )}
      </section>
      {data && pages > 1 && (
        <div className={rs.actions}>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Trang trước
          </Button>
          <span className={rs.muted}>
            Trang {page} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Trang sau
          </Button>
        </div>
      )}
      <Dialog
        open={Boolean(hiding)}
        onClose={() => setHiding(null)}
        title="Ẩn đánh giá này?"
        actions={
          <>
            <Button variant="outline" onClick={() => setHiding(null)}>
              Huỷ
            </Button>
            <Button variant="ink" loading={busy} disabled={reason.trim().length < 5} onClick={() => hiding && setHidden(hiding, true)}>
              Ẩn đánh giá
            </Button>
          </>
        }
      >
        <Field label="Lý do ẩn" hint="Người viết sẽ thấy lý do này. Tối thiểu 5 ký tự.">
          <Input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
