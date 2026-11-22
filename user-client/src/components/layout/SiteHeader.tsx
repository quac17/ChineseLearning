'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useModule } from '@/context/ModuleContext';
import { routes } from '@/lib/courses';
import { PROGRAMS, PROGRAM_ORDER } from '@/lib/programs';
import { LinkButton, Logo, SearchInput } from '@/components/ui';
import { ThemeToggle } from './ThemeToggle';
import s from './layout.module.css';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Quản trị viên', TEACHER: 'Giáo viên', STUDENT: 'Học viên' };

export function SiteHeader() {
  const { user, logout } = useAuth();
  const { activeModule, setActiveModule } = useModule();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Show the current search term on the catalog; clear it elsewhere. Read from
  // window rather than useSearchParams, which would need a Suspense boundary
  // around the whole header.
  useEffect(() => {
    setQ(pathname === '/courses' ? new URLSearchParams(window.location.search).get('q') ?? '' : '');
  }, [pathname]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/courses?q=${encodeURIComponent(term)}` : '/courses');
  };

  const pickProgram = (id: (typeof PROGRAM_ORDER)[number]) => {
    setActiveModule(id);
    router.push(routes.catalog({ program: id }));
  };

  const initial = user?.fullName.trim().charAt(0).toUpperCase() ?? '';
  const canTeach = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  return (
    <header className={s.header}>
      <div className={`container ${s.bar}`}>
        <Logo height={34} />
        <Link href="/courses" className={`${s.navLink} ${s.hideMd}`}>
          Danh mục
        </Link>
        {/* On phones the catalog has its own search box (AppSearch), so this one steps aside there. */}
        <form className={`${s.search} ${pathname === '/courses' ? s.searchOffOnCatalog : ''}`} role="search" onSubmit={onSearch}>
          <SearchInput
            label="Tìm khoá học"
            placeholder="Tìm khoá học: HSK 1, YCT, giao tiếp…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            name="q"
          />
        </form>
        {user?.role === 'STUDENT' && (
          <Link href={routes.myCourses} className={`${s.navLink} ${s.hideMd}`}>
            Khoá học của tôi
          </Link>
        )}
        {canTeach && (
          <Link href={user?.role === 'ADMIN' ? '/admin' : '/teacher'} className={`${s.navLink} ${s.hideMd}`}>
            {user?.role === 'ADMIN' ? 'Quản trị' : 'Khu giáo viên'}
          </Link>
        )}
        <div className={s.actions}>
          <ThemeToggle />
          {user ? (
            <div className={s.menuWrap} ref={menuRef}>
              <button
                type="button"
                className={s.avatar}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Tài khoản của ${user.fullName}`}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {initial}
              </button>
              {menuOpen && (
                <div className={s.menu} role="menu">
                  <div className={s.menuHead}>
                    <b style={{ display: 'block' }}>{user.fullName}</b>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {ROLE_LABEL[user.role] ?? user.role} · {user.email}
                    </span>
                  </div>
                  {user.role === 'STUDENT' && (
                    <Link role="menuitem" href={routes.myCourses} className={s.menuItem}>
                      Khoá học của tôi
                    </Link>
                  )}
                  <Link role="menuitem" href="/flashcards" className={s.menuItem}>
                    Ôn tập
                  </Link>
                  <Link role="menuitem" href={routes.account} className={s.menuItem}>
                    Tài khoản
                  </Link>
                  {canTeach && (
                    <Link role="menuitem" href={user.role === 'ADMIN' ? '/admin' : '/teacher'} className={s.menuItem}>
                      {user.role === 'ADMIN' ? 'Quản trị' : 'Khu giáo viên'}
                    </Link>
                  )}
                  <button
                    role="menuitem"
                    type="button"
                    className={s.menuItem}
                    onClick={async () => {
                      await logout();
                      router.push('/');
                    }}
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <LinkButton href="/login" variant="outline" size="sm" className={s.hideSm}>
                Đăng nhập
              </LinkButton>
              <LinkButton href="/register" variant="ink" size="sm">
                Đăng ký
              </LinkButton>
            </>
          )}
        </div>
      </div>
      <nav className={s.cats} aria-label="Chương trình và ôn tập">
        {PROGRAM_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={s.catBtn}
            aria-current={pathname.startsWith('/courses') && activeModule === id ? 'true' : undefined}
            onClick={() => pickProgram(id)}
          >
            {PROGRAMS[id].name}
          </button>
        ))}
        <span className={s.catSep} aria-hidden="true" />
        <Link href="/flashcards" className={s.catBtn}>
          Flashcard
        </Link>
        <Link href="/quiz" className={s.catBtn}>
          Quiz
        </Link>
        <Link href="/writing" className={s.catBtn}>
          Luyện viết chữ Hán
        </Link>
      </nav>
    </header>
  );
}
