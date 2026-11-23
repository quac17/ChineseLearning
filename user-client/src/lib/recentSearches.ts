/**
 * "Tìm gần đây": the last few catalog search terms, kept in this browser only.
 * A personal convenience, so every storage call is wrapped: private windows and
 * blocked storage simply show no history.
 */
const KEY = 'chinese_learner_recent_searches';
export const MAX_RECENT_SEARCHES = 5;

/** Puts `term` first, drops a case-insensitive duplicate, keeps the newest few. */
export function addRecentSearch(list: string[], term: string): string[] {
  const t = term.trim();
  if (!t) return list;
  const key = t.toLocaleLowerCase('vi');
  return [t, ...list.filter((x) => x.toLocaleLowerCase('vi') !== key)].slice(0, MAX_RECENT_SEARCHES);
}

export function loadRecentSearches(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSearches(list: string[]): void {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked or full: history is optional.
  }
}
