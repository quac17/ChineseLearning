import { buildOutline } from './course-outline';

const t = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s));
const lesson = (id: string, sort: number, section: string | null, created = 0) => ({
  id,
  sort_order: sort,
  section_id: section,
  created_at: t(created),
});
const section = (id: string, sort: number, created = 0) => ({ id, title: `Phần ${id}`, sort_order: sort, created_at: t(created) });

describe('buildOutline', () => {
  it('keeps the flat lesson order when the course has no sections', () => {
    const out = buildOutline([], [lesson('b', 1, null), lesson('a', 0, null), lesson('c', 1, null, 5)]);
    expect(out.lessons.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(out.sections).toEqual([]);
  });

  it('orders lessons by section order, then lesson order inside each section', () => {
    const out = buildOutline(
      [section('s2', 1), section('s1', 0)],
      [lesson('x', 0, 's2'), lesson('y', 3, 's1'), lesson('z', 1, 's1')],
    );
    expect(out.lessons.map((l) => l.id)).toEqual(['z', 'y', 'x']);
    expect(out.sections).toEqual([
      { id: 's1', title: 'Phần s1', sortOrder: 0, lessonIds: ['z', 'y'] },
      { id: 's2', title: 'Phần s2', sortOrder: 1, lessonIds: ['x'] },
    ]);
  });

  it('puts lessons without a section (or with an unknown one) after every section', () => {
    const out = buildOutline(
      [section('s1', 0)],
      [lesson('free', 0, null), lesson('in', 5, 's1'), lesson('ghost', 1, 'gone')],
    );
    expect(out.lessons.map((l) => l.id)).toEqual(['in', 'free', 'ghost']);
    expect(out.sections[0].lessonIds).toEqual(['in']);
  });

  it('keeps empty sections and breaks sort ties by creation time', () => {
    const out = buildOutline([section('b', 0, 2), section('a', 0, 1)], []);
    expect(out.sections.map((s) => [s.id, s.lessonIds])).toEqual([
      ['a', []],
      ['b', []],
    ]);
  });
});
