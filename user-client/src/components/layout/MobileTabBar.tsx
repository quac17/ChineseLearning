'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import s from './layout.module.css';

const icon = (d: ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    {d}
  </svg>
);

/** Bottom tab bar at phone width (the PWA / app layout from the design). */
export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const tabs = [
    { href: '/', label: 'Nổi bật', match: (p: string) => p === '/', svg: icon(<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />) },
    { href: '/courses', label: 'Tìm kiếm', match: (p: string) => p.startsWith('/courses'), svg: icon(<><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /></>) },
    // Until /my-courses exists (learner pages PR), the profile page lists granted courses.
    { href: user ? '/profile#khoa-hoc' : '/login', label: 'Khoá của tôi', match: () => false, svg: icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" fill="currentColor" /></>) },
    { href: '/flashcards', label: 'Ôn tập', match: (p: string) => ['/flashcards', '/quiz', '/writing'].some((x) => p.startsWith(x)), svg: icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6" /></>) },
    {
      href: user ? '/profile' : '/login',
      label: user ? 'Tài khoản' : 'Đăng nhập',
      match: (p: string) => p.startsWith('/profile') || p.startsWith('/login') || p.startsWith('/register'),
      svg: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>),
    },
  ];

  return (
    <nav className={s.tabbar} aria-label="Điều hướng chính">
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className={s.tabItem} aria-current={t.match(pathname) ? 'page' : undefined}>
          {t.svg}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
