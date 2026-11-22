'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Input, ProgramBadge, Skeleton, useToast } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { formatVnd } from '@/lib/programs';
import type { CourseItem } from '@/lib/types';
import { AdminOnly } from '../AdminOnly';
import s from '../admin.module.css';

export default function AdminPricesPage() {
  return (
    <AdminOnly>
      <Prices />
    </AdminOnly>
  );
}

function Prices() {
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
          <h1 className={s.title}>Giá khoá học</h1>
          <p className={s.sub}>
            Giá tính bằng đồng, áp dụng cho đơn tạo sau khi lưu. Để trống = khoá trả phí chưa mở bán (không có nút
            mua). Giáo viên chỉ xem được giá.
          </p>
        </div>
      </div>
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : !courses ? (
        <Skeleton height={240} />
      ) : (
        <section className={`${s.card} ${s.listCard}`} aria-label="Danh sách khoá học">
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Khoá học</th>
                <th scope="col">Chương trình</th>
                <th scope="col">Giáo viên</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Giá</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <PriceRow key={c.id} course={c} />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function PriceRow({ course }: { course: CourseItem }) {
  const toast = useToast();
  const [saved, setSaved] = useState<number | null>(course.priceVnd ?? null);
  const [value, setValue] = useState(course.priceVnd ? String(course.priceVnd) : '');
  const [saving, setSaving] = useState(false);
  const parsed = value.trim() === '' ? null : Number(value.replace(/[.\s,₫]/g, ''));
  const invalid = parsed !== null && (!Number.isInteger(parsed) || parsed < 1000);
  const dirty = parsed !== saved;

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest<{ priceVnd: number | null }>(`/courses/${course.id}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ priceVnd: parsed }),
      });
      setSaved(res.priceVnd);
      setValue(res.priceVnd ? String(res.priceVnd) : '');
      toast.show(res.priceVnd ? `Đã đặt giá ${formatVnd(res.priceVnd)}` : 'Đã chuyển về chưa mở bán');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputId = `price-${course.id}`;
  return (
    <tr>
      <td>
        <b>{course.title}</b>
        {!course.isPublished && (
          <>
            {' '}
            <Badge tone="neutral">Nháp</Badge>
          </>
        )}
      </td>
      <td>
        <ProgramBadge program={course.module} />
      </td>
      <td className={s.nowrap}>{course.teacher?.fullName}</td>
      <td className={s.nowrap}>
        {course.isFree ? (
          <Badge tone="new">Miễn phí</Badge>
        ) : saved ? (
          <Badge tone="success">Đang bán</Badge>
        ) : (
          <Badge tone="warning">Chưa mở bán</Badge>
        )}
      </td>
      <td>
        {course.isFree ? (
          <span className={s.muted}>Không áp dụng</span>
        ) : (
          <form
            className={s.priceCell}
            onSubmit={(e) => {
              e.preventDefault();
              if (!invalid && dirty) save();
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Giá của {course.title} (đồng)
            </label>
            <Input
              id={inputId}
              inputMode="numeric"
              placeholder="Chưa mở bán"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={invalid || undefined}
            />
            <Button type="submit" variant="ink" size="sm" loading={saving} disabled={invalid || !dirty}>
              Lưu
            </Button>
            {invalid && <span className={s.muted}>Tối thiểu 1.000 ₫</span>}
          </form>
        )}
      </td>
    </tr>
  );
}
