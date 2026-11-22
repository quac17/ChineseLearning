'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import type { CourseItem } from '@/lib/types';
import { EDITOR_TABS, StatusBadge, editorHref } from '../../shared';
import s from '../../teacher.module.css';
import { EditorContext } from './editor';

/** Course editor shell: breadcrumb, title, tabs as links (one route per tab). */
export default function CourseEditorLayout({ children, params }: { children: ReactNode; params: { id: string } }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [course, setCourseState] = useState<CourseItem | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setCourseState(await apiRequest<CourseItem>(`/courses/${params.id}`));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được khoá học.');
    }
  }, [params.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setCourse = useCallback((update: (c: CourseItem) => CourseItem) => {
    setCourseState((c) => (c ? update(c) : c));
  }, []);

  if (error && !course) {
    return (
      <div className={s.card}>
        <EmptyState
          title="Không mở được khoá học"
          action={
            <LinkButton href="/teacher/courses" variant="outline">
              Về danh sách khoá học
            </LinkButton>
          }
        >
          {error}
        </EmptyState>
      </div>
    );
  }
  if (!course) return <Skeleton height={360} />;

  // GET /courses/:id is public; editing is only for the owner or an admin (the API checks it too).
  if (user && user.role !== 'ADMIN' && course.teacherId !== user.id) {
    return (
      <div className={s.card}>
        <EmptyState
          title="Bạn không quản lý khoá học này"
          action={
            <LinkButton href="/teacher/courses" variant="outline">
              Về khoá học của bạn
            </LinkButton>
          }
        >
          Chỉ giáo viên phụ trách khoá hoặc Admin mới sửa được.
        </EmptyState>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={{ course, reload, setCourse }}>
      <div className={s.page}>
        <div className={s.editorHead}>
          <p className={s.crumb}>
            <Link href="/teacher/courses">Khoá học</Link> <span className={s.muted}>›</span>{' '}
            <span className={s.crumbCurrent}>{course.title}</span>
          </p>
          <div className={s.head}>
            <div className={s.titleRow}>
              <h1 className={s.editorTitle}>{course.title}</h1>
              <StatusBadge published={course.isPublished} />
            </div>
            <LinkButton href={`/courses/${course.id}`} variant="outline" size="sm" target="_blank" rel="noopener">
              Xem như học viên
            </LinkButton>
          </div>
          <nav className={s.tabs} aria-label="Phần của khoá học">
            {EDITOR_TABS.map((t) => {
              const href = editorHref(course.id, t.id);
              return (
                <Link key={t.id} href={href} className={s.tab} aria-current={pathname === href ? 'page' : undefined}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {children}
      </div>
    </EditorContext.Provider>
  );
}
