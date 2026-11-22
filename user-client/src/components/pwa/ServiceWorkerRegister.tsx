'use client';

import { useEffect } from 'react';

/**
 * Registers public/sw.js in production builds only. Under `next dev` it
 * removes any worker left from a production run on the same port, so stale
 * shell assets never mask hot reload.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // No worker means no offline page; the site still works online.
    });
  }, []);
  return null;
}
