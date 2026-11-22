'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert, EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import type { CourseItem } from '@/lib/types';
import { StatusBadge, editorHref, studentCount, useManagedCourses, wordCount } from './shared';
import s from './teacher.module.css';

interface Todo {
  key: string;
  text: ReactNode;
  href: string;
  action: string;
}

/** Gaps worth fixing, computed from the courses themselves (at most 6). */
function todosOf(courses: CourseItem[]): Todo[] {
  const out: Todo[] = [];
  for (const c of courses) {
    const title = <b>{c.title}</b>;
    if (c.lessons.length === 0) {
      out.push({ key: `${c.id}-lessons`, text: <>Khoá {title} chưa có bài giảng</>, href: editorHref(c.id, 'lessons'), action: 'Thêm bài' });
      continue;
    }
    const noWords = c.lessons.filter((l) => !l.vocabularyCount).length;
    if (noWords > 0) {
      out.push({
        key: `${c.id}-vocab`,
        text: (
          <>
            Khoá {title} còn {noWords} bài chưa có từ vựng
          </>
        ),
        href: editorHref(c.id, 'vocabulary'),
        action: 'Thêm từ vựng',
      });
    }
    if (c.documents.length === 0) {
      out.push({ key: `${c.id}-docs`, text: <>Khoá {title} chưa có tài liệu</>, href: editorHref(c.id, 'documents'), action: 'Thêm tài liệu' });
    }
    if (!c.isPublished) {
      out.push({ key: `${c.id}-draft`, text: <>Khoá {title} vẫn là bản nháp</>, href: editorHref(c.id, 'info'), action: 'Xuất bản' });
    }
  }
  return out.slice(0, 6);
}

export default function TeacherOverviewPage() {
  const { user } = useAuth();
  const { courses, error } = useManagedCourses();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>{isAdmin ? 'Tổng quan khoá học' : `Xin chào, ${user?.fullName ?? ''}`}</h1>
          {isAdmin && <p className={s.sub}>Bạn đang xem mọi khoá học với quyền Admin.</p>}
        </div>
        <LinkButton href="/teacher/courses?new=1" variant="ink" size="sm">
          + Tạo khoá học
        </LinkButton>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {!courses ? (
        !error && <Skeleton height={320} />
      ) : courses.length === 0 ? (
        <div className={s.card}>
          <EmptyState
            title="Bạn chưa có khoá học nào"
            action={
              <LinkButton href="/teacher/courses?new=1" variant="ink">
                Tạo khoá học đầu tiên
              </LinkButton>
            }
          >
            Tạo khoá, thêm bài giảng và tài liệu, rồi xuất bản để học viên thấy trong danh mục.
          </EmptyState>
        </div>
      ) : (
        <Overview courses={courses} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function Overview({ courses, isAdmin }: { courses: CourseItem[]; isAdmin: boolean }) {
  const students = new Set(courses.flatMap((c) => (c.enrollments ?? []).map((e) => e.studentId))).size;
  const published = courses.filter((c) => c.isPublished).length;
  const lessons = courses.reduce((n, c) => n + c.lessons.length, 0);
  const documents = courses.reduce((n, c) => n + c.documents.length, 0);
  const words = courses.reduce((n, c) => n + wordCount(c), 0);
  const lessonsWithWords = courses.reduce((n, c) => n + c.lessons.filter((l) => l.vocabularyCount).length, 0);
  const todos = todosOf(courses);

  return (
    <>
      <div className={s.kpis}>
        <Kpi label="Học viên có quyền xem" value={students} note={isAdmin ? 'trên mọi khoá' : 'trên tất cả khoá của bạn'} />
        <Kpi label="Khoá đã xuất bản" value={published} note={`${courses.length - published} bản nháp`} />
        <Kpi label="Bài giảng" value={lessons} note={`${documents} tài liệu`} />
        <Kpi label="Từ vựng" value={words} note={`trong ${lessonsWithWords} bài`} />
      </div>

      {todos.length > 0 && (
        <section className={`${s.card} ${s.pad}`} aria-labelledby="todo-title">
          <h2 id="todo-title" className={s.cardTitle}>
            Việc cần làm
          </h2>
          <ul className={s.todos}>
            {todos.map((t) => (
              <li key={t.key}>
                <span>{t.text}</span>
                <Link href={t.href} className={s.textLink}>
                  {t.action}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={s.card} aria-labelledby="mine-title">
        <div className={s.cardHead}>
          <h2 id="mine-title" className={s.cardTitle}>
            {isAdmin ? 'Khoá học' : 'Khoá học của bạn'}
          </h2>
          <Link href="/teacher/courses" className={s.textLink}>
            Xem tất cả
          </Link>
        </div>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Khoá học</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Bài</th>
                <th scope="col">Học viên</th>
                <th scope="col">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {courses.slice(0, 8).map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.title}</b>
                  </td>
                  <td className={s.nowrap}>
                    <StatusBadge published={c.isPublished} />
                  </td>
                  <td>{c.lessons.length}</td>
                  <td>{studentCount(c)}</td>
                  <td className={s.right}>
                    <Link href={editorHref(c.id, 'info')} className={s.textLink} aria-label={`Sửa ${c.title}`}>
                      Sửa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`${s.note} ${s.pad}`}>Khu giáo viên không hiển thị doanh thu; giá và đơn hàng do admin quản lý.</p>
      </section>
    </>
  );
}

function Kpi({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className={`${s.card} ${s.kpi}`}>
      <span className={s.muted}>{label}</span>
      <p className={s.kpiValue}>{value.toLocaleString('vi-VN')}</p>
      <span className={s.kpiNote}>{note}</span>
    </div>
  );
}
