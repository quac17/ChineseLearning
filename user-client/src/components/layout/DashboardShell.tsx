'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import s from './layout.module.css';

export interface DashboardNavItem {
  href: string;
  label: string;
}

interface DashboardShellProps {
  area: 'teacher' | 'admin';
  nav: DashboardNavItem[];
  children: ReactNode;
}

const AREA_LABEL = { teacher: 'Khu giáo viên', admin: 'Quản trị' };

/** Left-nav shell for the teacher and admin areas (docs/design/canvas/Teacher*, Admin*). */
export function DashboardShell({ area, nav, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const dark = area === 'admin';
  const logo = dark ? '/brand/vankinh-icon-reversed.svg' : '/brand/vankinh-icon-full.svg';

  return (
    <div className={s.shell}>
      <nav className={`${s.side} ${dark ? s.sideAdmin : ''}`} aria-label={AREA_LABEL[area]}>
        <Link href="/" className={s.sideBrand} style={{ color: 'inherit', textDecoration: 'none' }} aria-label="Vân Kính, trang chủ">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={32} height={32} />
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <b style={{ fontSize: 16 }}>Vân Kính</b>
            <span className={s.sideArea}>{AREA_LABEL[area]}</span>
          </span>
        </Link>
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={s.sideLink} aria-current={active ? 'page' : undefined}>
              {item.label}
            </Link>
          );
        })}
        <div className={s.sideFoot}>
          <Link href="/" className={s.sideLink}>
            Về trang học viên
          </Link>
          {user && (
            <button
              type="button"
              className={s.sideLink}
              style={{ border: 0, background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
              onClick={async () => {
                await logout();
                router.push('/');
              }}
            >
              Đăng xuất ({user.fullName})
            </button>
          )}
          <ThemeToggle />
        </div>
      </nav>
      <main id="main" className={s.content}>
        {children}
      </main>
    </div>
  );
}
