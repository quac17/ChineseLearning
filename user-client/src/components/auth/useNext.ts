'use client';

/**
 * The same-site path to go back to after login/register (`?next=/courses/x`).
 * Read from window, not useSearchParams, so the pages need no Suspense.
 * Anything that is not a plain site path ("//evil", "https://…") is ignored.
 */
export function readNext(): string | null {
  if (typeof window === 'undefined') return null;
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function withNext(path: string): string {
  const next = readNext();
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
