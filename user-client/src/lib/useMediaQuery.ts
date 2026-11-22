'use client';

import { useSyncExternalStore } from 'react';

/** The phone layout breakpoint used across the app CSS (≤ 760px). */
export const PHONE_QUERY = '(max-width: 760px)';

/**
 * Whether a media query matches, kept in sync with resizes. Renders `false`
 * on the server, so use it for layout that may switch after hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
