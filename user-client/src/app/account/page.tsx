'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, EmptyState, Field, Input, LinkButton, Skeleton, Textarea } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import { formatVnd } from '@/lib/programs';
import type { OrderItem, OrderStatus } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import s from './account.module.css';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Quản trị viên', TEACHER: 'Giáo viên', STUDENT: 'Học viên' };

type Msg = { tone: 'success' | 'error'; text: string } | null;

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

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

  return (
    <div className={s.page}>
      <h1 className={s.title}>Tài khoản</h1>
      <div className={s.layout}>
        <nav className={s.nav} aria-label="Mục tài khoản">
          <a href="#ho-so" className={s.navItem}>
            Hồ sơ
          </a>
          <a href="#bao-mat" className={s.navItem}>
            Bảo mật
          </a>
          {user.role === 'STUDENT' && (
            <a href="#don-hang" className={s.navItem}>
              Đơn hàng
            </a>
          )}
          <button
            type="button"
            className={s.navItem}
            onClick={async () => {
              await logout();
              router.push('/');
            }}
          >
            Đăng xuất
          </button>
        </nav>
        <div className={s.main}>
          <section id="ho-so" className={s.section} aria-labelledby="ho-so-title">
            <div className={s.who}>
              <span className={s.avatar} aria-hidden="true">
                {user.fullName.trim().charAt(0).toUpperCase()}
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

          <section id="bao-mat" className={s.section} aria-labelledby="bao-mat-title">
            <h2 id="bao-mat-title">Đổi mật khẩu</h2>
            <PasswordForm />
          </section>

          {user.role === 'STUDENT' && (
            <section id="don-hang" className={s.section} aria-labelledby="don-hang-title">
              <h2 id="don-hang-title">Đơn hàng</h2>
              <Orders />
            </section>
          )}
        </div>
      </div>
    </div>
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
