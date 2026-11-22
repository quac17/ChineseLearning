'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  ProgramBadge,
  Select,
  Skeleton,
  useToast,
} from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { formatVnd, PROGRAM_ORDER, PROGRAMS } from '@/lib/programs';
import type { CourseItem, ProgramModule } from '@/lib/types';
import { AdminOnly } from '../AdminOnly';
import s from '../admin.module.css';

type SaleState = 'draft' | 'free' | 'selling' | 'unpriced';

const SALE: Record<SaleState, { label: string; tone: BadgeTone }> = {
  selling: { label: 'Đang bán', tone: 'success' },
  free: { label: 'Miễn phí', tone: 'new' },
  unpriced: { label: 'Chưa mở bán', tone: 'warning' },
  draft: { label: 'Bản nháp', tone: 'neutral' },
};

function saleState(c: CourseItem): SaleState {
  if (!c.isPublished) return 'draft';
  if (c.isFree) return 'free';
  return c.priceVnd ? 'selling' : 'unpriced';
}

const onlineLearners = (c: CourseItem) => (c.enrollments ?? []).filter((e) => e.canView).length;

export default function AdminCoursesPage() {
  return (
    <AdminOnly>
      <Courses />
    </AdminOnly>
  );
}

function Courses() {
  const [courses, setCourses] = useState<CourseItem[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [program, setProgram] = useState<'' | ProgramModule>('');
  const [sale, setSale] = useState<'' | SaleState>('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCourses(await apiRequest<CourseItem[]>('/courses/manage'));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được khoá học.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (courses ?? []).filter(
      (c) =>
        (!program || c.module === program) &&
        (!sale || saleState(c) === sale) &&
        (!needle || c.title.toLowerCase().includes(needle) || (c.teacher?.fullName ?? '').toLowerCase().includes(needle)),
    );
  }, [courses, q, program, sale]);

  const current = courses?.find((c) => c.id === selected) ?? null;

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Khoá học</h1>
          <p className={s.sub}>Mọi khoá trên Chinese Learner: giá bán, miễn phí, hiển thị. Chọn một khoá để sửa.</p>
        </div>
      </div>

      <div className={s.filters} role="search">
        <label htmlFor="course-q" className="sr-only">
          Tìm khoá học
        </label>
        <Input
          id="course-q"
          type="search"
          placeholder="Tên khoá, giáo viên"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label htmlFor="course-program" className="sr-only">
          Chương trình
        </label>
        <Select id="course-program" value={program} onChange={(e) => setProgram(e.target.value as '' | ProgramModule)}>
          <option value="">Mọi chương trình</option>
          {PROGRAM_ORDER.map((p) => (
            <option key={p} value={p}>
              {PROGRAMS[p].name}
            </option>
          ))}
        </Select>
        <label htmlFor="course-sale" className="sr-only">
          Trạng thái
        </label>
        <Select id="course-sale" value={sale} onChange={(e) => setSale(e.target.value as '' | SaleState)}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(SALE) as SaleState[]).map((k) => (
            <option key={k} value={k}>
              {SALE[k].label}
            </option>
          ))}
        </Select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={s.layout}>
        <section className={`${s.card} ${s.listCard}`} aria-label="Danh sách khoá học">
          {!courses ? (
            !error && (
              <div className={s.state}>
                <Skeleton height={240} />
              </div>
            )
          ) : filtered.length === 0 ? (
            <div className={s.state}>
              <EmptyState title="Không có khoá học nào">Thử bỏ bớt bộ lọc.</EmptyState>
            </div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Khoá học</th>
                  <th scope="col">Giáo viên</th>
                  <th scope="col">Giá</th>
                  <th scope="col">Bài giảng</th>
                  <th scope="col">Học viên</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const st = SALE[saleState(c)];
                  return (
                    <tr
                      key={c.id}
                      className={s.rowButton}
                      data-selected={selected === c.id}
                      onClick={() => setSelected(c.id)}
                    >
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelected(c.id)}
                          aria-pressed={selected === c.id}
                          style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                        >
                          {c.title}
                        </button>
                        <div style={{ marginTop: 4 }}>
                          <ProgramBadge program={c.module} />
                        </div>
                      </td>
                      <td className={s.nowrap}>{c.teacher?.fullName}</td>
                      <td className={s.nowrap}>
                        {c.isFree ? (
                          <span className={s.muted}>Miễn phí</span>
                        ) : c.priceVnd ? (
                          formatVnd(c.priceVnd)
                        ) : (
                          <b style={{ color: 'var(--error)' }}>Chưa đặt</b>
                        )}
                      </td>
                      <td>{c.lessons.length}</td>
                      <td>{onlineLearners(c)}</td>
                      <td className={s.nowrap}>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {current && <CourseEditor key={current.id} course={current} onSaved={load} onClose={() => setSelected(null)} />}
      </div>
      <p className={s.note}>
        Học viên = số người đang được mở quyền xem (mua hoặc cấp tay). Giá áp dụng cho đơn tạo sau khi lưu; giáo viên chỉ
        xem được giá, không thấy doanh thu.
      </p>
    </div>
  );
}

function CourseEditor({ course, onSaved, onClose }: { course: CourseItem; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const [price, setPrice] = useState(course.priceVnd ? String(course.priceVnd) : '');
  const [isFree, setIsFree] = useState(course.isFree);
  const [isPublished, setIsPublished] = useState(course.isPublished);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const parsed = price.trim() === '' ? null : Number(price.replace(/[.\s,₫]/g, ''));
  const priceInvalid = !isFree && parsed !== null && (!Number.isInteger(parsed) || parsed < 1000 || parsed > 100_000_000);
  const priceChanged = !isFree && parsed !== (course.priceVnd ?? null);
  const flagsChanged = isFree !== course.isFree || isPublished !== course.isPublished;
  const dirty = priceChanged || flagsChanged;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (priceInvalid || !dirty) return;
    setBusy(true);
    setError('');
    try {
      if (flagsChanged) {
        await apiRequest(`/courses/${course.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isFree, isPublished }),
        });
      }
      if (priceChanged) {
        await apiRequest(`/courses/${course.id}/price`, {
          method: 'PATCH',
          body: JSON.stringify({ priceVnd: parsed }),
        });
      }
      toast.show(`Đã lưu “${course.title}”`);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const learners = onlineLearners(course);

  return (
    <aside className={`${s.card} ${s.detail}`} aria-labelledby="course-editor-title">
      <h2 id="course-editor-title">{course.title}</h2>
      <div>
        <div className={s.kv}>
          <span className={s.muted}>Giáo viên</span>
          <b>{course.teacher?.fullName}</b>
        </div>
        <div className={s.kv}>
          <span className={s.muted}>Bài giảng · tài liệu</span>
          <b>
            {course.lessons.length} bài · {course.documents.length} tài liệu
          </b>
        </div>
        <div className={s.kv}>
          <span className={s.muted}>Học viên có quyền xem</span>
          <b>{learners}</b>
        </div>
      </div>

      <form className={s.form} onSubmit={save}>
        {error && <Alert tone="error">{error}</Alert>}
        <Field
          label="Giá bán (₫)"
          hint={isFree ? 'Khoá miễn phí không cần giá.' : 'Để trống = chưa mở bán (không có nút mua). Tối thiểu 1.000 ₫.'}
          error={priceInvalid ? 'Giá từ 1.000 ₫ đến 100.000.000 ₫, số nguyên.' : undefined}
        >
          <Input
            inputMode="numeric"
            placeholder="Chưa mở bán"
            value={isFree ? '' : price}
            disabled={isFree}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Checkbox label="Khoá miễn phí" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        <Checkbox
          label="Hiển thị trên trang khoá học"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        <div className={s.actions} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href={`/courses/${course.id}`}>Xem trang khoá</Link>
          <span className={s.actions}>
            <Button variant="outline" size="sm" onClick={onClose}>
              Đóng
            </Button>
            <Button type="submit" variant="ink" size="sm" loading={busy} disabled={priceInvalid || !dirty}>
              Lưu
            </Button>
          </span>
        </div>
      </form>
    </aside>
  );
}
