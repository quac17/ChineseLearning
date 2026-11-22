'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Input, Rating, Skeleton, useToast } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { learnerText } from '@/lib/courses';
import type { CourseItem } from '@/lib/types';
import { AdminOnly } from '../AdminOnly';
import s from '../admin.module.css';

/**
 * Admin only: a course rating may be saved only with its real source, and
 * the offline learner count is shown apart from online accounts
 * (docs/design/DECISIONS.md). Empty = the rating block is hidden.
 */
export default function AdminRatingsPage() {
  return (
    <AdminOnly>
      <Ratings />
    </AdminOnly>
  );
}

function Ratings() {
  const [courses, setCourses] = useState<CourseItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<CourseItem[]>('/courses/manage')
      .then(setCourses)
      .catch((err: Error) => setError(err.message || 'Không tải được khoá học.'));
  }, []);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Đánh giá & học viên</h1>
          <p className={s.sub}>
            Chỉ nhập điểm khi có nguồn thật, ví dụ “khảo sát 120 học viên lớp offline 2025”. Nguồn hiện ngay cạnh số sao.
            Để trống cả hai thì khối đánh giá bị ẩn. Số học viên online tự đếm từ tài khoản đang có quyền xem; học viên
            offline hiện riêng, không cộng gộp.
          </p>
        </div>
      </div>
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : !courses ? (
        <Skeleton height={240} />
      ) : (
        <div className={s.ratingList}>
          {courses.map((c) => (
            <RatingRow key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function RatingRow({ course }: { course: CourseItem }) {
  const toast = useToast();
  const [saved, setSaved] = useState({
    value: course.rating?.value ?? null,
    source: course.rating?.source ?? null,
    offline: course.offlineLearnerCount ?? null,
  });
  const [value, setValue] = useState(saved.value != null ? String(saved.value).replace('.', ',') : '');
  const [source, setSource] = useState(saved.source ?? '');
  const [offline, setOffline] = useState(saved.offline != null ? String(saved.offline) : '');
  const [saving, setSaving] = useState(false);

  const parsedValue = value.trim() === '' ? null : Number(value.trim().replace(',', '.'));
  const parsedOffline = offline.trim() === '' ? null : Number(offline.trim().replace(/[.\s]/g, ''));
  const trimmedSource = source.trim();
  const problem =
    parsedValue !== null && (!Number.isFinite(parsedValue) || parsedValue < 1 || parsedValue > 5)
      ? 'Điểm từ 1 đến 5.'
      : parsedValue !== null && !trimmedSource
        ? 'Cần nhập nguồn thật cho điểm này.'
        : parsedValue === null && trimmedSource
          ? 'Nhập điểm cho nguồn này, hoặc xoá nguồn.'
          : trimmedSource && trimmedSource.length < 10
            ? 'Nguồn tối thiểu 10 ký tự: ai chấm, bao nhiêu người, khi nào.'
            : parsedOffline !== null && (!Number.isInteger(parsedOffline) || parsedOffline < 1)
              ? 'Số học viên offline là số nguyên từ 1.'
              : '';
  const dirty =
    parsedValue !== saved.value || (trimmedSource || null) !== saved.source || parsedOffline !== saved.offline;

  const save = async () => {
    setSaving(true);
    try {
      const rating = await apiRequest<{ rating: CourseItem['rating'] }>(`/courses/${course.id}/rating`, {
        method: 'PATCH',
        body: JSON.stringify({ ratingValue: parsedValue, ratingSource: trimmedSource || null }),
      });
      const learners = await apiRequest<{ offlineLearnerCount: number | null }>(`/courses/${course.id}/offline-learners`, {
        method: 'PATCH',
        body: JSON.stringify({ offlineLearnerCount: parsedOffline }),
      });
      setSaved({
        value: rating.rating?.value ?? null,
        source: rating.rating?.source ?? null,
        offline: learners.offlineLearnerCount,
      });
      setSource(rating.rating?.source ?? '');
      toast.show(rating.rating ? 'Đã lưu đánh giá kèm nguồn' : 'Đã lưu, khối đánh giá đang ẩn');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const id = (name: string) => `${name}-${course.id}`;
  const learners = learnerText(course.learnerCount ?? 0, saved.offline);
  return (
    <form
      className={`${s.card} ${s.ratingRow}`}
      aria-label={`Đánh giá của ${course.title}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem && dirty) save();
      }}
    >
      <div className={s.ratingHead}>
        <b>{course.title}</b>
        {!course.isPublished && <Badge tone="neutral">Nháp</Badge>}
        <span className={s.muted}>
          {learners ?? 'Chưa có học viên'} · Đang hiện:{' '}
          {saved.value != null && saved.source ? <Rating value={saved.value} source={saved.source} /> : 'không có đánh giá'}
        </span>
      </div>
      <div className={s.ratingFields}>
        <label htmlFor={id('value')} className={s.ratingField}>
          <span>Điểm (1–5)</span>
          <Input
            id={id('value')}
            inputMode="decimal"
            placeholder="4,5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={Boolean(problem && parsedValue !== null) || undefined}
          />
        </label>
        <label htmlFor={id('source')} className={`${s.ratingField} ${s.ratingSource}`}>
          <span>Nguồn đánh giá</span>
          <Input
            id={id('source')}
            placeholder="khảo sát 120 học viên lớp offline 2025"
            maxLength={200}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </label>
        <label htmlFor={id('offline')} className={s.ratingField}>
          <span>Học viên offline</span>
          <Input
            id={id('offline')}
            inputMode="numeric"
            placeholder="Không có"
            value={offline}
            onChange={(e) => setOffline(e.target.value)}
          />
        </label>
        <Button type="submit" variant="ink" size="sm" loading={saving} disabled={Boolean(problem) || !dirty}>
          Lưu
        </Button>
      </div>
      {problem && (
        <p className={s.ratingProblem} role="status">
          {problem}
        </p>
      )}
    </form>
  );
}
