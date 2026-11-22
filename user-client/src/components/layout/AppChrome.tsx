'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { DashboardShell } from './DashboardShell';
import { MobileTabBar } from './MobileTabBar';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

const TEACHER_NAV = [
  { href: '/teacher', label: 'Tổng quan' },
  { href: '/teacher/courses', label: 'Khoá học' },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Thống kê' },
  { href: '/admin/users', label: 'Người dùng' },
  { href: '/admin/courses', label: 'Khoá học' },
  { href: '/admin/prices', label: 'Giá khoá học' },
  { href: '/admin/ratings', label: 'Đánh giá & học viên' },
  { href: '/admin/reviews', label: 'Kiểm duyệt đánh giá' },
  { href: '/admin/orders', label: 'Đơn hàng' },
];

/** Learner pages rebuilt on the new design: they lay out their own width. */
const REBUILT = ['/courses', '/my-courses', '/account', '/checkout', '/flashcards', '/quiz', '/writing', '/login', '/register', '/offline'];
/** Pages that show public/images/stock photos must carry the credit line. */
const WITH_STOCK_PHOTOS = ['/'];

/**
 * Chooses the chrome per area: learner pages get header/footer/tab bar,
 * the lesson player gets its own dark top bar only, /teacher and /admin get
 * the dashboard shell. Their nav grows as those areas are rebuilt
 * (docs/design/canvas/Teacher*, Admin*).
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith('/teacher')) {
    return (
      <DashboardShell area="teacher" nav={TEACHER_NAV}>
        {children}
      </DashboardShell>
    );
  }

  if (pathname.startsWith('/admin')) {
    return (
      <DashboardShell area="admin" nav={ADMIN_NAV}>
        <div className="legacy-dash">{children}</div>
      </DashboardShell>
    );
  }

  if (pathname.startsWith('/learn')) {
    return (
      <>
        <a href="#main" className="skip-link">
          Bỏ qua tới nội dung
        </a>
        <div id="main">{children}</div>
      </>
    );
  }

  const rebuilt = pathname === '/' || REBUILT.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <>
      <a href="#main" className="skip-link">
        Bỏ qua tới nội dung
      </a>
      <SiteHeader />
      {/* "legacy" keeps the old centred column for pages not yet rebuilt. */}
      <main id="main" className={rebuilt ? undefined : 'legacy'}>
        {children}
      </main>
      {/* Turn photo credits on for pages that show public/images/stock photos. */}
      <SiteFooter showPhotoCredits={WITH_STOCK_PHOTOS.includes(pathname)} />

      <MobileTabBar />
    </>
  );
}
