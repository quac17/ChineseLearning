'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useModule } from '@/context/ModuleContext';
import { HOME_THEME, PROGRAM_MODULES, SITE_INFO } from '@/lib/modules';
import { ModuleSelection } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học sinh',
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { activeModule, setActiveModule, colorMode, toggleColorMode } = useModule();

  const isAdmin = user?.role === 'ADMIN';

  const navItems = isAdmin
    ? [{ href: '/admin', label: 'Quản trị' }]
    : [
        { href: '/', label: 'Trang chủ' },
        { href: '/courses', label: 'Khóa học & Video' },
        { href: '/flashcards', label: 'Flashcard' },
        { href: '/quiz', label: 'Quiz' },
        { href: '/writing', label: 'Viết chữ Hán' },
        ...(user?.role === 'TEACHER' ? [{ href: '/teacher', label: 'Giáo viên' }] : []),
      ];

  const allPills: Array<{ id: ModuleSelection; name: string; c1: string }> = [
    { id: 'all', name: 'Tất cả', c1: HOME_THEME.c1 },
    ...PROGRAM_MODULES.map((m) => ({ id: m.id, name: m.name, c1: m.c1 })),
  ];

  const showModuleBar =
    !isAdmin && !pathname.startsWith('/teacher') && !pathname.startsWith('/admin');

  const displayName = user
    ? user.fullName.replace(/\s*\([^)]*\)\s*$/, '').trim() || user.fullName
    : '';

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header>
      <div className="bar">
        <Link href={isAdmin ? '/admin' : '/'} className="brand-link">
          <div className="seal han">云</div>
          <div className="brand">
            <b className="han">{SITE_INFO.name}</b>
            <small>{SITE_INFO.tagline}</small>
          </div>
        </Link>

        <nav className="main-nav" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="user-bar">
          <button
            type="button"
            className="btn alt sm"
            onClick={toggleColorMode}
            title="Chuyển giao diện Sáng / Tối"
          >
            {colorMode === 'dark' ? '☀️' : '🌙'}
          </button>

          {user ? (
            <>
              <Link
                href="/profile"
                className={`tag role-${user.role.toLowerCase()}`}
                style={{ textDecoration: 'none' }}
                title="Xem và chỉnh sửa thông tin cá nhân"
              >
                {ROLE_LABELS[user.role]} · {displayName}
              </Link>
              <button type="button" className="btn alt sm" onClick={handleLogout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <Link href="/login" className="btn sm">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>

      {showModuleBar && (
        <div className="mods" aria-label="Chọn chương trình học">
          {allPills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              aria-pressed={activeModule === pill.id}
              onClick={() => setActiveModule(pill.id)}
            >
              <i style={{ background: pill.c1 }} />
              {pill.name}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
