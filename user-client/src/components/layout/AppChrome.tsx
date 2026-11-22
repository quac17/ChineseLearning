'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { DashboardShell } from './DashboardShell';
import { MobileTabBar } from './MobileTabBar';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/**
 * Chooses the chrome per area: learner pages get header/footer/tab bar,
 * /teacher and /admin get the dashboard shell. Their nav grows as those
 * areas are rebuilt (docs/design/canvas/Teacher*, Admin*).
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith('/teacher')) {
    return (
      <DashboardShell area="teacher" nav={[{ href: '/teacher', label: 'Khoá học' }]}>
        <div className="legacy-dash">{children}</div>
      </DashboardShell>
    );
  }

  if (pathname.startsWith('/admin')) {
    return (
      <DashboardShell area="admin" nav={[{ href: '/admin', label: 'Tổng quan' }]}>
        <div className="legacy-dash">{children}</div>
      </DashboardShell>
    );
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Bỏ qua tới nội dung
      </a>
      <SiteHeader />
      {/* "legacy" keeps the old centred column for pages not yet rebuilt. */}
      <main id="main" className="legacy">
        {children}
      </main>
      {/* Turn photo credits on for pages that show public/images/stock photos. */}
      <SiteFooter />

      <MobileTabBar />
    </>
  );
}
