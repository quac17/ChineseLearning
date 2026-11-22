'use client';

import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { LinkButton, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { routes } from '@/lib/courses';
import type { Role } from '@/lib/types';
import { useOnline } from '@/lib/useOnline';
import s from './states.module.css';

interface StatePageProps {
  /** Small grey label above the title, e.g. "404 · Không tìm thấy". */
  kicker?: string;
  /** Large decorative Hanzi (aria-hidden), e.g. 迷路 on the 404. */
  han?: string;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Inside the teacher/admin shell: no centring or page padding. */
  inline?: boolean;
}

/**
 * One panel for every full-page state (docs/design/canvas/States.dc.html).
 * The copy always says what to do next.
 */
export function StatePage({ kicker, han, title, children, actions, inline }: StatePageProps) {
  return (
    <div className={`${s.page} ${inline ? s.inline : ''}`}>
      <section className={s.panel} aria-labelledby="state-title">
        {kicker && <span className={s.kicker}>{kicker}</span>}
        {han && (
          <span className={`han ${s.han}`} aria-hidden="true">
            {han}
          </span>
        )}
        <h1 id="state-title" className={s.title}>
          {title}
        </h1>
        {children && <p className={s.body}>{children}</p>}
        {actions && <div className={s.actions}>{actions}</div>}
      </section>
    </div>
  );
}

const ROLE_HOME: Record<Role, { href: string; label: string }> = {
  STUDENT: { href: '/my-courses', label: 'Về khoá học của tôi' },
  TEACHER: { href: '/teacher', label: 'Về khu giáo viên' },
  ADMIN: { href: '/admin', label: 'Về trang quản trị' },
};

/**
 * Cosmetic gate for the teacher and admin areas; the API enforces the roles.
 * Logged out: ask to log in and come back. Wrong role: the 403 pattern with a
 * way back to the user's own area.
 */
export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) return <Skeleton height={240} />;

  if (!user) {
    return (
      <StatePage
        inline
        kicker="Cần đăng nhập"
        title="Đăng nhập để vào trang này"
        actions={
          <LinkButton href={routes.login(pathname)} variant="ink">
            Đăng nhập
          </LinkButton>
        }
      >
        Trang này dành cho tài khoản giáo viên hoặc quản trị viên.
      </StatePage>
    );
  }

  if (!roles.includes(user.role)) {
    const home = ROLE_HOME[user.role];
    return (
      <StatePage
        inline
        kicker="403 · Không có quyền"
        title="Bạn không có quyền vào trang này"
        actions={
          <LinkButton href={home.href} variant="ink">
            {home.label}
          </LinkButton>
        }
      >
        Tài khoản của bạn không dùng được khu vực này. Nếu cần quyền, hãy liên hệ quản trị viên.
      </StatePage>
    );
  }

  return <>{children}</>;
}

/**
 * "Bạn đang ngoại tuyến" bar at the top of every screen while the browser is
 * offline. It sets data-network on <html> so sticky headers move below it.
 */
export function OfflineBar() {
  const online = useOnline();

  useEffect(() => {
    const root = document.documentElement;
    if (online) delete root.dataset.network;
    else root.dataset.network = 'offline';
  }, [online]);

  if (online) return null;
  return (
    <div className={s.offline} role="status">
      <span className={s.dot} aria-hidden="true" />
      Bạn đang ngoại tuyến
      <span className={s.offlineMore}>· các nút cần mạng tạm khoá</span>
    </div>
  );
}
