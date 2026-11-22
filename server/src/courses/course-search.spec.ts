import { courseSearchClause, courseSearchPattern, escapeLike, MAX_SEARCH_LENGTH } from './course-search';

describe('escapeLike', () => {
  it('escapes %, _ and the escape char itself', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });
});

describe('courseSearchPattern', () => {
  it('wraps the trimmed query in wildcards', () => {
    expect(courseSearchPattern('  giao tiep ')).toBe('%giao tiep%');
  });

  it('returns null for empty, blank or non-string input', () => {
    expect(courseSearchPattern('')).toBeNull();
    expect(courseSearchPattern('   ')).toBeNull();
    expect(courseSearchPattern(undefined)).toBeNull();
    expect(courseSearchPattern(['a', 'b'])).toBeNull();
  });

  it('keeps wildcards literal', () => {
    expect(courseSearchPattern('%')).toBe('%\\%%');
    expect(courseSearchPattern('_')).toBe('%\\_%');
  });

  it('normalises decomposed Vietnamese to NFC', () => {
    expect(courseSearchPattern('tiếp')).toBe('%tiếp%');
  });

  it('cuts long input', () => {
    expect(courseSearchPattern('a'.repeat(500))).toBe(`%${'a'.repeat(MAX_SEARCH_LENGTH)}%`);
  });
});

describe('courseSearchClause', () => {
  it('compares unaccented columns with the unaccented param', () => {
    expect(courseSearchClause('$2')).toBe(
      'unaccent(c.title) ILIKE unaccent($2) OR unaccent(c.description) ILIKE unaccent($2) OR unaccent(u.full_name) ILIKE unaccent($2)',
    );
  });
});
