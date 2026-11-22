'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, EmptyState, Field, Input, LinkButton, Radio, Skeleton, Textarea } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import { formatVnd } from '@/lib/programs';
import type { OrderItem, OrderStatus } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useModule, type ThemePreference } from '@/context/ModuleContext';
import { SUPPORT_CONTACT } from '@/lib/site';
import s from './account.module.css';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Quản trị viên', TEACHER: 'Giáo viên', STUDENT: 'Học viên' };

type Msg = { tone: 'success' | 'error'; text: string } | null;

type SectionId = 'ho-so' | 'bao-mat' | 'don-hang' | 'giao-dien' | 'ho-tro';

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { open, show, close } = useOpenSection();

  // A link like /account#giao-dien: the sections only exist once the user has loaded.
  const ready = !loading && Boolean(user);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (ready && id) document.getElementById(id)?.scrollIntoView();
  }, [ready]);

  if (loading) {
    return (
      <div className={s.page} aria-busy="true" aria-label="Đang tải tài khoản">
        <Skeleton width={200} height={32} />
        <Skeleton height={240} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={s.page}>
        <EmptyState
          title="Bạn chưa đăng nhập"
          action={
            <LinkButton href="/login" variant="ink">
              Đăng nhập
            </LinkButton>
          }
        >
          Đăng nhập để xem và sửa thông tin tài khoản.
        </EmptyState>
      </div>
    );
  }

  const since = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })
    : null;
  const isStudent = user.role === 'STUDENT';
  const initial = user.fullName.trim().charAt(0).toUpperCase();
  const onLogout = async () => {
    await logout();
    router.push('/');
  };
  const sectionProps = (id: SectionId) => ({
    id,
    className: s.section,
    'aria-labelledby': `${id}-title`,
    'data-open': open === id ? '' : undefined,
  });

  return (
    <div className={s.page} data-open={open ?? undefined}>
      <h1 className={s.title}>Tài khoản</h1>

      {/* Phones (AppAccount board): a settings list; each row opens its section. */}
      <div className={s.settings}>
        <div className={s.me}>
          <span className={s.meAvatar} aria-hidden="true">
            {initial}
          </span>
          <b className={s.meName}>{user.fullName}</b>
          <span className={s.muted}>{user.email}</span>
        </div>
        <h2 className={s.group}>{isStudent ? 'Học tập' : 'Hồ sơ'}</h2>
        <ul className={s.list}>
          <SettingsRow href="#ho-so" onOpen={() => show('ho-so')}>
            {isStudent ? 'Hồ sơ và mục tiêu học' : 'Hồ sơ'}
          </SettingsRow>
          {isStudent && (
            <SettingsRow href="#don-hang" onOpen={() => show('don-hang')}>
              Đơn hàng
            </SettingsRow>
          )}
        </ul>
        <h2 className={s.group}>Tài khoản</h2>
        <ul className={s.list}>
          <SettingsRow href="#bao-mat" onOpen={() => show('bao-mat')}>
            Đổi mật khẩu
          </SettingsRow>
          <SettingsRow href="#giao-dien" onOpen={() => show('giao-dien')} value={<ThemeValue />}>
            Giao diện
          </SettingsRow>
          {SUPPORT_CONTACT && (
            <SettingsRow href="#ho-tro" onOpen={() => show('ho-tro')} value={SUPPORT_CONTACT}>
              Hỗ trợ
            </SettingsRow>
          )}
          <li>
            <button type="button" className={`${s.row} ${s.logout}`} onClick={onLogout}>
              Đăng xuất
            </button>
          </li>
        </ul>
      </div>

      <div className={s.layout}>
        <nav className={s.nav} aria-label="Mục tài khoản">
          <a href="#ho-so" className={s.navItem}>
            Hồ sơ
          </a>
          <a href="#bao-mat" className={s.navItem}>
            Bảo mật
          </a>
          {isStudent && (
            <a href="#don-hang" className={s.navItem}>
              Đơn hàng
            </a>
          )}
          <a href="#giao-dien" className={s.navItem}>
            Giao diện
          </a>
          {SUPPORT_CONTACT && (
            <a href="#ho-tro" className={s.navItem}>
              Hỗ trợ
            </a>
          )}
          <button type="button" className={s.navItem} onClick={onLogout}>
            Đăng xuất
          </button>
        </nav>
        <div className={s.main}>
          <button type="button" className={s.back} onClick={close}>
            <span aria-hidden="true">‹</span> Tài khoản
          </button>

          <section {...sectionProps('ho-so')}>
            <div className={s.who}>
              <span className={s.avatar} aria-hidden="true">
                {initial}
              </span>
              <div>
                <h2 id="ho-so-title">Hồ sơ</h2>
                <span className={s.muted}>
                  {ROLE_LABEL[user.role] ?? user.role}
                  {since ? ` từ ${since}` : ''}
                </span>
              </div>
            </div>
            <ProfileForm />
          </section>

          <section {...sectionProps('bao-mat')}>
            <h2 id="bao-mat-title">Đổi mật khẩu</h2>
            <PasswordForm />
          </section>

          {isStudent && (
            <section {...sectionProps('don-hang')}>
              <h2 id="don-hang-title">Đơn hàng</h2>
              <Orders />
            </section>
          )}

          <section {...sectionProps('giao-dien')}>
            <h2 id="giao-dien-title">Giao diện</h2>
            <ThemeChoice />
          </section>

          {SUPPORT_CONTACT && (
            <section {...sectionProps('ho-tro')}>
              <h2 id="ho-tro-title">Hỗ trợ</h2>
              <p className={s.text}>
                Cần giúp về khoá học, thanh toán hay tài khoản? Liên hệ <b>{SUPPORT_CONTACT}</b>.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const SECTIONS: SectionId[] = ['ho-so', 'bao-mat', 'don-hang', 'giao-dien', 'ho-tro'];

/**
 * Which section is open on phones, kept in the URL hash so a row can be linked
 * to and the browser back button returns to the list. On wider screens every
 * section is shown and the hash only scrolls to it.
 */
function useOpenSection() {
  const [open, setOpen] = useState<SectionId | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    const read = () => {
      const id = window.location.hash.slice(1) as SectionId;
      setOpen(SECTIONS.includes(id) ? id : null);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const show = (id: SectionId) => {
    pushed.current = true;
    setOpen(id);
    window.scrollTo({ top: 0 });
  };
  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setOpen(null);
    }
  };
  return { open, show, close };
}

function SettingsRow({
  href,
  onOpen,
  value,
  children,
}: {
  href: string;
  onOpen: () => void;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li>
      {/* A real link, so the hash changes (back button) and it works without JS. */}
      <a href={href} className={s.row} onClick={onOpen}>
        <span>{children}</span>
        <span className={s.rowEnd}>
          {value && <span className={s.rowValue}>{value}</span>}
          <span aria-hidden="true">›</span>
        </span>
      </a>
    </li>
  );
}

const THEME_OPTIONS: Array<{ id: ThemePreference; label: string; hint: string }> = [
  { id: 'system', label: 'Theo máy', hint: 'Sáng hoặc tối theo cài đặt của thiết bị.' },
  { id: 'light', label: 'Sáng', hint: 'Nền trắng, chữ đen.' },
  { id: 'dark', label: 'Tối', hint: 'Nền tối, dễ chịu khi học buổi tối.' },
];

function ThemeValue() {
  const { themePreference } = useModule();
  return <>{THEME_OPTIONS.find((o) => o.id === themePreference)?.label}</>;
}

function ThemeChoice() {
  const { themePreference, setThemePreference } = useModule();
  return (
    <fieldset className={s.choices}>
      <legend className="sr-only">Chọn giao diện</legend>
      {THEME_OPTIONS.map((o) => (
        <div key={o.id} className={s.choice}>
          <Radio
            name="theme"
            value={o.id}
            label={o.label}
            checked={themePreference === o.id}
            onChange={() => setThemePreference(o.id)}
            aria-describedby={`theme-${o.id}-hint`}
          />
          <span id={`theme-${o.id}-hint`} className={s.muted}>
            {o.hint}
          </span>
        </div>
      ))}
    </fieldset>
  );
}

function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setPhone(user.phone || '');
    setBio(user.bio || '');
  }, [user]);

  if (!user) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      await updateProfile({ fullName: fullName.trim(), phone: phone.trim(), bio: bio.trim() });
      setMsg({ tone: 'success', text: 'Đã lưu thay đổi.' });
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message || 'Không lưu được thay đổi.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className={s.two}>
        <Field label="Họ và tên">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} autoComplete="name" />
        </Field>
        <Field label="Số điện thoại">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="Email (không đổi được)">
          <Input value={user.email} disabled />
        </Field>
      </div>
      <Field label={user.role === 'STUDENT' ? 'Mục tiêu học tập' : 'Giới thiệu'}>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={3} />
      </Field>
      <div className={s.actions}>
        <Button type="submit" variant="ink" loading={saving}>
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const mismatch = confirm.length > 0 && confirm !== next;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ tone: 'error', text: 'Mật khẩu nhập lại không khớp.' });
      return;
    }
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg({ tone: 'success', text: 'Đã đổi mật khẩu.' });
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message || 'Không đổi được mật khẩu.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className={s.two}>
        <Field label="Mật khẩu hiện tại">
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        </Field>
        <div />
        <Field label="Mật khẩu mới" hint="Tối thiểu 6 ký tự.">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} autoComplete="new-password" />
        </Field>
        <Field label="Nhập lại mật khẩu mới" error={mismatch ? 'Chưa khớp với mật khẩu mới.' : undefined}>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" />
        </Field>
      </div>
      <div className={s.actions}>
        <Button type="submit" variant="outline" loading={saving}>
          Đổi mật khẩu
        </Button>
      </div>
    </form>
  );
}

const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Chờ thanh toán', tone: 'warning' },
  PAID: { label: 'Đã thanh toán', tone: 'success' },
  EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  CANCELLED: { label: 'Đã huỷ', tone: 'neutral' },
  REFUNDED: { label: 'Đã hoàn tiền', tone: 'info' },
};

function Orders() {
  const [orders, setOrders] = useState<OrderItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiRequest<OrderItem[]>('/payments/orders')
      .then((data) => !cancelled && setOrders(data))
      .catch((err: Error) => !cancelled && setError(err.message || 'Không tải được đơn hàng.'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!orders) return <Skeleton height={120} />;
  if (orders.length === 0) {
    return <p className={s.muted}>Bạn chưa có đơn hàng nào.</p>;
  }
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">Mã đơn</th>
            <th scope="col">Khoá học</th>
            <th scope="col">Ngày</th>
            <th scope="col">Số tiền</th>
            <th scope="col">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className={s.nowrap}>{o.code}</td>
              <td>{o.courseId ? <Link href={routes.course(o.courseId)}>{o.courseTitle}</Link> : o.courseTitle}</td>
              <td className={s.nowrap}>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
              <td className={s.nowrap}>{formatVnd(o.amountVnd)}</td>
              <td className={s.nowrap}>
                <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                {o.status === 'PENDING' && (
                  <Link href={routes.checkout(o.id)} className={s.inlineLink}>
                    Tiếp tục
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
