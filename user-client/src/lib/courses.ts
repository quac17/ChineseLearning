import type { CourseItem, LessonItem, ProgramModule } from './types';
import { PROGRAM_ORDER } from './programs';

/** URL helpers, so routes are spelled in one place. */
export const routes = {
  catalog: (params: { q?: string; program?: ProgramModule | null } = {}) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.program) sp.set('program', params.program);
    const qs = sp.toString();
    return qs ? `/courses?${qs}` : '/courses';
  },
  course: (courseId: string) => `/courses/${encodeURIComponent(courseId)}`,
  learn: (courseId: string, lessonId?: string) =>
    lessonId
      ? `/learn/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`
      : `/learn/${encodeURIComponent(courseId)}`,
  myCourses: '/my-courses',
  account: '/account',
};

export function parseProgram(value: string | null | undefined): ProgramModule | null {
  return value && (PROGRAM_ORDER as string[]).includes(value) ? (value as ProgramModule) : null;
}

export function sortedLessons(course: Pick<CourseItem, 'lessons'>): LessonItem[] {
  return [...course.lessons].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** First lesson this viewer can play, else the first lesson at all. */
export function firstLesson(course: Pick<CourseItem, 'lessons'>): LessonItem | null {
  const lessons = sortedLessons(course);
  return lessons.find((l) => l.canWatch) ?? lessons[0] ?? null;
}

/** First free preview lesson, for "Xem bài học thử". */
export function previewLesson(course: Pick<CourseItem, 'lessons'>): LessonItem | null {
  return sortedLessons(course).find((l) => l.isFree) ?? null;
}

export function hasPreview(course: Pick<CourseItem, 'lessons'>): boolean {
  return course.lessons.some((l) => l.isFree);
}

/** "3 bài · 1 tài liệu" (only the parts that exist). */
export function courseMeta(course: Pick<CourseItem, 'lessons' | 'documents'>): string {
  const parts = [`${course.lessons.length} bài`];
  if (course.documents.length) parts.push(`${course.documents.length} tài liệu`);
  return parts.join(' · ');
}

/** Durations are free text from teachers ("12 phút", "14:00"); show them as given. */
export function lessonDuration(lesson: Pick<LessonItem, 'duration'>): string {
  return lesson.duration?.trim() || '';
}
