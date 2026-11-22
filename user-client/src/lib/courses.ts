import type { CourseItem, CourseProgress, CourseSection, LessonItem, ProgramModule } from './types';
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
  checkout: (orderId: string) => `/checkout/${encodeURIComponent(orderId)}`,
  /** Login that comes back to `next` (same-site paths only). */
  login: (next?: string) => (next ? `/login?next=${encodeURIComponent(next)}` : '/login'),
};

export function parseProgram(value: string | null | undefined): ProgramModule | null {
  return value && (PROGRAM_ORDER as string[]).includes(value) ? (value as ProgramModule) : null;
}

type WithLessons = Pick<CourseItem, 'lessons'> & Partial<Pick<CourseItem, 'sections'>>;

/** One block of the course outline: a section, or the lessons outside any section (section = null). */
export interface OutlineGroup {
  section: CourseSection | null;
  /** 1-based position among sections ("Phần 2"); 0 for the lessons outside any section. */
  number: number;
  lessons: LessonItem[];
}

const bySortOrder = (a: LessonItem, b: LessonItem) => a.sortOrder - b.sortOrder;

/**
 * The course outline. Without sections: one group with every lesson. With
 * sections: one group per section in order, then the lessons without a
 * section (only when there are any).
 */
export function courseOutline(course: WithLessons): OutlineGroup[] {
  const sections = course.sections ?? [];
  if (sections.length === 0) return [{ section: null, number: 0, lessons: [...course.lessons].sort(bySortOrder) }];
  const byId = new Map(course.lessons.map((l) => [l.id, l]));
  const placed = new Set<string>();
  const groups: OutlineGroup[] = sections.map((section, i) => {
    const lessons = section.lessonIds.flatMap((id) => {
      const lesson = byId.get(id);
      if (!lesson || placed.has(id)) return [];
      placed.add(id);
      return [lesson];
    });
    return { section, number: i + 1, lessons };
  });
  const rest = course.lessons.filter((l) => !placed.has(l.id)).sort(bySortOrder);
  if (rest.length) groups.push({ section: null, number: 0, lessons: rest });
  return groups;
}

/** "Phần 2: Giới thiệu bản thân", or "Bài khác" for lessons outside any section. */
export function sectionHeading(group: Pick<OutlineGroup, 'section' | 'number'>): string {
  return group.section ? `Phần ${group.number}: ${group.section.title}` : 'Bài khác';
}

/** Every lesson in the order learners see them (section by section). */
export function sortedLessons(course: WithLessons): LessonItem[] {
  return courseOutline(course).flatMap((g) => g.lessons);
}

/** True when the outline has real sections to show (else render a flat list). */
export function hasSections(course: Partial<Pick<CourseItem, 'sections'>>): boolean {
  return (course.sections?.length ?? 0) > 0;
}

/** First lesson this viewer can play, else the first lesson at all. */
export function firstLesson(course: WithLessons): LessonItem | null {
  const lessons = sortedLessons(course);
  return lessons.find((l) => l.canWatch) ?? lessons[0] ?? null;
}

/** First free preview lesson, for "Xem bài học thử". */
export function previewLesson(course: WithLessons): LessonItem | null {
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

/** A paid course that can be bought right now. */
export function isOnSale(course: Pick<CourseItem, 'isFree' | 'priceVnd'>): boolean {
  return !course.isFree && typeof course.priceVnd === 'number' && course.priceVnd > 0;
}

/**
 * Where "Học tiếp" should land: the last lesson touched if it is unfinished,
 * else the next unfinished playable lesson after it, else the first
 * unfinished one, else the first playable lesson.
 */
export function resumeLesson(course: WithLessons, progress: CourseProgress | null): LessonItem | null {
  const lessons = sortedLessons(course).filter((l) => l.canWatch);
  if (lessons.length === 0) return firstLesson(course);
  const done = new Set((progress?.lessons ?? []).filter((p) => p.completed).map((p) => p.lessonId));
  const lastIndex = progress?.lastLessonId ? lessons.findIndex((l) => l.id === progress.lastLessonId) : -1;
  if (lastIndex >= 0 && !done.has(lessons[lastIndex].id)) return lessons[lastIndex];
  const after = lessons.slice(lastIndex + 1).find((l) => !done.has(l.id));
  return after ?? lessons.find((l) => !done.has(l.id)) ?? lessons[0];
}
