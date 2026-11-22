/** Longest search query we look at; longer input is cut, not rejected. */
export const MAX_SEARCH_LENGTH = 100;

/** Escapes LIKE wildcards so "100%" or "a_b" match literally (default escape char is \). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Turns the raw `q` query param into an ILIKE pattern, or null when there is
 * nothing to search for. Accents are not stripped here: the SQL compares
 * `unaccent(column) ILIKE unaccent(pattern)`, so "giao tiep" finds "Giao tiếp"
 * and "doi song" finds "đời sống".
 */
export function courseSearchPattern(search: unknown): string | null {
  if (typeof search !== 'string') return null;
  const q = search.normalize('NFC').trim().slice(0, MAX_SEARCH_LENGTH);
  return q ? `%${escapeLike(q)}%` : null;
}

/** WHERE fragment matching title, description and teacher name against param `p`. */
export function courseSearchClause(p: string): string {
  return ['c.title', 'c.description', 'u.full_name']
    .map((col) => `unaccent(${col}) ILIKE unaccent(${p})`)
    .join(' OR ');
}
