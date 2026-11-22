'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Checkbox, EmptyState, LinkButton, Select, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useModule } from '@/context/ModuleContext';
import { apiRequest } from '@/lib/api';
import { courseMeta, hasPreview, parseProgram, routes } from '@/lib/courses';
import { PROGRAMS, PROGRAM_ORDER } from '@/lib/programs';
import type { CourseItem } from '@/lib/types';
import s from './catalog.module.css';

type SortKey = 'relevant' | 'newest' | 'title';

export default function CatalogPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <Catalog />
    </Suspense>
  );
}

function Catalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { setActiveModule } = useModule();

  const q = searchParams.get('q')?.trim() ?? '';
  const program = parseProgram(searchParams.get('program'));
  const legacyCourseId = searchParams.get('courseId');

  const [courses, setCourses] = useState<CourseItem[] | null>(null);
  const [error, setError] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyPaid, setOnlyPaid] = useState(false);
  const [withPreview, setWithPreview] = useState(false);
  const [sort, setSort] = useState<SortKey>('relevant');

  // Old links were /courses?courseId=…; the course now has its own page.
  useEffect(() => {
    if (legacyCourseId) router.replace(routes.course(legacyCourseId));
  }, [legacyCourseId, router]);

  // Keep the header's program highlight in step with the URL.
  useEffect(() => {
    setActiveModule(program ?? 'all');
  }, [program, setActiveModule]);

  useEffect(() => {
    if (legacyCourseId) return;
    let cancelled = false;
    setCourses(null);
    setError('');
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (program) params.set('module', program);
    const qs = params.toString();
    apiRequest<CourseItem[]>(`/courses${qs ? `?${qs}` : ''}`)
      .then((data) => !cancelled && setCourses(data))
      .catch((err: Error) => !cancelled && setError(err.message || 'Không thể tải danh sách khoá học.'));
    return () => {
      cancelled = true;
    };
  }, [q, program, user?.id, legacyCourseId]);

  const visible = useMemo(() => {
    if (!courses) return [];
    let list = courses.filter((c) => {
      if (onlyFree && !onlyPaid && !c.isFree) return false;
      if (onlyPaid && !onlyFree && c.isFree) return false;
      if (withPreview && !hasPreview(c)) return false;
      return true;
    });
    if (sort === 'newest') list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    return list;
  }, [courses, onlyFree, onlyPaid, withPreview, sort]);

  const filtersOn = onlyFree || onlyPaid || withPreview;
  const clearFilters = () => {
    setOnlyFree(false);
    setOnlyPaid(false);
    setWithPreview(false);
  };

  const heading = q
    ? courses
      ? `${visible.length} kết quả cho “${q}”`
      : `Đang tìm “${q}”`
    : program
      ? `Khoá học ${PROGRAMS[program].name}`
      : 'Tất cả khoá học';

  return (
    <div className={`container ${s.page}`}>
      <p className={s.crumbs}>
        <Link href="/">Trang chủ</Link>
        <span className={s.crumbSep} aria-hidden="true">
          ›
        </span>
        Khoá học
      </p>
      <h1 className={s.title}>{heading}</h1>

      <nav className={s.chips} aria-label="Lọc theo chương trình">
        <Link href={routes.catalog({ q })} className={s.chip} aria-current={!program ? 'true' : undefined}>
          Tất cả
        </Link>
        {PROGRAM_ORDER.map((id) => (
          <Link
            key={id}
            href={routes.catalog({ q, program: id })}
            className={s.chip}
            aria-current={program === id ? 'true' : undefined}
          >
            {PROGRAMS[id].name}
          </Link>
        ))}
        {q && (
          <Link href={routes.catalog({ program })} className={s.chip}>
            Bỏ từ khoá “{q}” <span aria-hidden="true">×</span>
          </Link>
        )}
      </nav>

      <div className={s.layout}>
        <aside className={s.filters} aria-label="Bộ lọc">
          <div className={s.filtersHead}>
            <h2>Bộ lọc</h2>
            {filtersOn && (
              <Button variant="text" size="sm" onClick={clearFilters}>
                Xoá lọc
              </Button>
            )}
          </div>
          <fieldset className={s.group}>
            <legend>Giá</legend>
            <Checkbox label="Miễn phí" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
            <Checkbox label="Trả phí" checked={onlyPaid} onChange={(e) => setOnlyPaid(e.target.checked)} />
            <Checkbox
              label="Có bài học thử"
              checked={withPreview}
              onChange={(e) => setWithPreview(e.target.checked)}
            />
          </fieldset>
        </aside>

        <section className={s.list} aria-label="Kết quả">
          <div className={s.toolbar}>
            <span className={s.count} aria-live="polite">
              {courses ? `${visible.length} khoá học` : ''}
            </span>
            <div className={s.sort}>
              <label htmlFor="sort">Sắp xếp</label>
              <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="relevant">Phù hợp nhất</option>
                <option value="newest">Mới nhất</option>
                <option value="title">Tên A–Z</option>
              </Select>
            </div>
          </div>

          {error ? (
            <div className={s.state}>
              <Alert tone="error" title="Không tải được khoá học.">
                {error}
              </Alert>
            </div>
          ) : !courses ? (
            <RowsSkeleton />
          ) : visible.length === 0 ? (
            <div className={s.state}>
              <EmptyState
                title={q ? `Không tìm thấy khoá học nào cho “${q}”` : 'Chưa có khoá học phù hợp'}
                action={
                  <LinkButton href={routes.catalog()} variant="outline">
                    Xem tất cả khoá học
                  </LinkButton>
                }
              >
                Thử từ khoá khác, bỏ bớt bộ lọc hoặc chọn chương trình khác.
              </EmptyState>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {visible.map((c) => (
                <li key={c.id}>
                  <CourseRow course={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function CourseRow({ course }: { course: CourseItem }) {
  const p = PROGRAMS[course.module];
  return (
    <Link href={routes.course(course.id)} className={s.row}>
      <div className={s.thumb} style={{ background: p.color }}>
        <span className={s.thumbHan} aria-hidden="true">
          {p.han}
        </span>
      </div>
      <div className={s.rowBody}>
        <span className={s.rowTitle}>{course.title}</span>
        {course.description && <span className={s.rowDesc}>{course.description}</span>}
        {course.teacher && <span className={s.rowMeta}>GV {course.teacher.fullName}</span>}
        <span className={s.rowMeta}>
          {p.name} · {courseMeta(course)}
        </span>
        <span className={s.tags}>
          {hasPreview(course) && !course.isFree && <Badge tone="preview">Có học thử</Badge>}
          {course.hasAccess && !course.isFree && <Badge tone="owned">Đã mở khoá</Badge>}
        </span>
      </div>
      {/* Prices arrive with checkout (PayOS); until then only free courses show one. */}
      <span className={s.price}>{course.isFree ? 'Miễn phí' : ''}</span>
    </Link>
  );
}

function RowsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải khoá học">
      {[0, 1, 2].map((i) => (
        <div key={i} className={s.row}>
          <Skeleton height="auto" style={{ aspectRatio: '16 / 9' }} />
          <div className={s.rowBody}>
            <Skeleton width="70%" height={20} />
            <Skeleton width="90%" />
            <Skeleton width="40%" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className={`container ${s.page}`}>
      <Skeleton width={280} height={32} />
      <RowsSkeleton />
    </div>
  );
}
