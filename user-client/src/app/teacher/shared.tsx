'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { PROGRAMS } from '@/lib/programs';
import type { CourseItem, ProgramModule } from '@/lib/types';
import s from './teacher.module.css';

/**
 * GET /courses/manage: the teacher's own courses (every course for an admin),
 * with lessons, documents and the students who can view each one.
 */
export function useManagedCourses() {
  const [courses, setCourses] = useState<CourseItem[] | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setCourses(await apiRequest<CourseItem[]>('/courses/manage'));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được danh sách khoá học.');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { courses, setCourses, error, reload };
}

export type EditorTab = 'info' | 'lessons' | 'vocabulary' | 'documents' | 'students' | 'reviews' | 'pricing';

/** Course editor tabs, in board order (docs/design/canvas/Teacher*). One route each. */
export const EDITOR_TABS: Array<{ id: EditorTab; label: string }> = [
  { id: 'info', label: 'Thông tin' },
  { id: 'lessons', label: 'Bài giảng' },
  { id: 'vocabulary', label: 'Từ vựng' },
  { id: 'documents', label: 'Tài liệu' },
  { id: 'students', label: 'Học viên' },
  { id: 'reviews', label: 'Đánh giá' },
  { id: 'pricing', label: 'Giá & bán' },
];

/** /teacher/courses/:id/:tab */
export const editorHref = (courseId: string, tab: EditorTab = 'info') =>
  `/teacher/courses/${courseId}/${EDITOR_TABS.some((t) => t.id === tab) ? tab : 'info'}`;

/** Students who can view the course right now (manual grant or purchase). */
export const studentCount = (c: CourseItem) => c.enrollments?.length ?? 0;

export const wordCount = (c: CourseItem) => c.lessons.reduce((n, l) => n + (l.vocabularyCount ?? 0), 0);

export function StatusBadge({ published }: { published: boolean }) {
  return published ? <Badge tone="success">Đã xuất bản</Badge> : <Badge tone="neutral">Bản nháp</Badge>;
}

/** Program-colour block with the program's Hanzi until courses have a real cover. */
export function CourseThumb({ module }: { module: ProgramModule }) {
  const p = PROGRAMS[module];
  return (
    <span className={s.thumb} style={{ background: p.color }} aria-hidden="true">
      <span className="han">{p.han}</span>
    </span>
  );
}

/** "22/11/2026" */
export const shortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';

/** Moves the item at `from` to `to` (a new array). */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
