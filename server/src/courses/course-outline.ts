/**
 * Lesson order of a course with sections ("Phần"): sections by their order,
 * lessons by their order inside each section, then lessons that belong to no
 * section. A course without sections keeps its flat lesson order.
 */
export interface OutlineSectionRow {
  id: string;
  title: string;
  sort_order: number;
  created_at: Date | string;
}

export interface OutlineLessonRow {
  id: string;
  sort_order: number;
  section_id: string | null;
  created_at: Date | string;
}

export interface OutlineSection {
  id: string;
  title: string;
  sortOrder: number;
  /** Lesson ids of this section, in display order. */
  lessonIds: string[];
}

type Ordered = { sort_order: number; created_at: Date | string };
const byOrder = (a: Ordered, b: Ordered) =>
  a.sort_order - b.sort_order || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

export function buildOutline<L extends OutlineLessonRow>(
  sectionRows: OutlineSectionRow[],
  lessonRows: L[],
): { sections: OutlineSection[]; lessons: L[] } {
  const sections = [...sectionRows].sort(byOrder);
  const lessons = [...lessonRows].sort(byOrder);
  const known = new Set(sections.map((s) => s.id));

  const ordered: L[] = [];
  const outline = sections.map((s) => {
    const own = lessons.filter((l) => l.section_id === s.id);
    ordered.push(...own);
    return { id: s.id, title: s.title, sortOrder: s.sort_order, lessonIds: own.map((l) => l.id) };
  });
  ordered.push(...lessons.filter((l) => !l.section_id || !known.has(l.section_id)));
  return { sections: outline, lessons: ordered };
}
