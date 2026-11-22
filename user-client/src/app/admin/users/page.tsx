'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  buttonClass,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  useToast,
} from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import type { Role, User } from '@/lib/types';
import { AdminOnly } from '../AdminOnly';
import s from '../admin.module.css';

const ROLE: Record<Role, { label: string; tone: BadgeTone }> = {
  ADMIN: { label: 'Admin', tone: 'owned' },
  TEACHER: { label: 'Giáo viên', tone: 'info' },
  STUDENT: { label: 'Học viên', tone: 'neutral' },
};
const ROLES = Object.keys(ROLE) as Role[];
const PAGE_SIZE = 20;

type Action = 'create' | 'edit' | 'role' | 'password' | 'lock' | 'delete';

const joined = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '–');

/** Lowercase, accents stripped, so "ngan" finds "Ngân". */
const fold = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

export default function AdminUsersPage() {
  return (
    <AdminOnly>
      <Users />
    </AdminOnly>
  );
}

function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [status, setStatus] = useState<'' | 'active' | 'locked'>('');
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<{ action: Action; target: User | null } | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await apiRequest<User[]>('/users'));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được danh sách người dùng.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const needle = fold(q.trim());
    return users.filter((u) => {
      if (role && u.role !== role) return false;
      if (status === 'active' && u.isActive === false) return false;
      if (status === 'locked' && u.isActive !== false) return false;
      if (!needle) return true;
      return [u.fullName, u.email, u.phone ?? ''].some((v) => fold(v).includes(needle));
    });
  }, [users, q, role, status]);

  useEffect(() => setPage(0), [q, role, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const done = (message: string) => {
    toast.show(message);
    setDialog(null);
    load();
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Người dùng</h1>
          <p className={s.sub}>Tạo tài khoản, đổi vai trò, khoá hoặc mở lại tài khoản.</p>
        </div>
        <Button variant="ink" size="sm" onClick={() => setDialog({ action: 'create', target: null })}>
          + Tạo tài khoản
        </Button>
      </div>

      <div className={s.filters} role="search">
        <label htmlFor="user-q" className="sr-only">
          Tìm người dùng
        </label>
        <Input
          id="user-q"
          type="search"
          placeholder="Tên, email, số điện thoại"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label htmlFor="user-role" className="sr-only">
          Vai trò
        </label>
        <Select id="user-role" value={role} onChange={(e) => setRole(e.target.value as '' | Role)}>
          <option value="">Mọi vai trò</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE[r].label}
            </option>
          ))}
        </Select>
        <label htmlFor="user-status" className="sr-only">
          Trạng thái
        </label>
        <Select id="user-status" value={status} onChange={(e) => setStatus(e.target.value as '' | 'active' | 'locked')}>
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Đã khoá</option>
        </Select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <section className={s.card} aria-label="Danh sách người dùng">
        {!users ? (
          !error && (
            <div className={s.state}>
              <Skeleton height={240} />
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className={s.state}>
            <EmptyState title="Không có người dùng nào">Thử bỏ bớt bộ lọc.</EmptyState>
          </div>
        ) : (
          <>
            {/* relative: keeps the sr-only header inside the scroll box on phones. */}
            <div style={{ overflowX: 'auto', position: 'relative' }}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th scope="col">Người dùng</th>
                    <th scope="col">Vai trò</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Khoá có quyền</th>
                    <th scope="col">Tham gia</th>
                    <th scope="col">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u) => (
                    <tr key={u.id} data-testid={`user-row-${u.email}`}>
                      <td>
                        <b>{u.fullName}</b>
                        {u.id === me?.id && <span className={s.muted}> (bạn)</span>}
                        <br />
                        <span className={s.muted} style={{ fontSize: 13 }}>
                          {u.email}
                          {u.phone ? ` · ${u.phone}` : ''}
                        </span>
                      </td>
                      <td>
                        <Badge tone={ROLE[u.role].tone}>{ROLE[u.role].label}</Badge>
                      </td>
                      <td>
                        {u.isActive === false ? (
                          <Badge tone="error">Đã khoá</Badge>
                        ) : (
                          <Badge tone="success">Hoạt động</Badge>
                        )}
                      </td>
                      <td className={s.nowrap}>
                        {u.role === 'TEACHER'
                          ? `${u._count?.taughtCourses ?? 0} khoá phụ trách`
                          : u.role === 'STUDENT'
                            ? (u._count?.enrollments ?? 0)
                            : '–'}
                      </td>
                      <td className={s.nowrap}>{joined(u.createdAt)}</td>
                      <td>
                        <RowMenu
                          user={u}
                          isSelf={u.id === me?.id}
                          onPick={(action) => setDialog({ action, target: u })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={s.pager}>
              <span className={s.muted}>
                {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + visible.length} / {filtered.length} người dùng
              </span>
              {pages > 1 && (
                <span className={s.actions}>
                  <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current >= pages - 1}
                    onClick={() => setPage(current + 1)}
                  >
                    Sau
                  </Button>
                </span>
              )}
            </div>
          </>
        )}
      </section>
      <p className={s.note}>
        Xoá tài khoản cần gõ lại email để xác nhận. Không xoá được tài khoản đã có đơn hàng hoặc giáo viên đang phụ
        trách khoá học; khi đó chỉ khoá.
      </p>

      {dialog && <UserDialog action={dialog.action} target={dialog.target} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  );
}

function RowMenu({ user, isSelf, onPick }: { user: User; isSelf: boolean; onPick: (a: Action) => void }) {
  const [open, setOpen] = useState(false);
  // Fixed position from the trigger, so the table's scroll box cannot clip the menu.
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean }>({ top: 0, right: 0, up: false });
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = `menu-${user.id}`;

  // The API refuses self-demotion, self-lock and self-delete; do not offer them.
  const items: Array<{ action: Action; label: string; danger?: boolean }> = [
    { action: 'edit', label: 'Sửa thông tin' },
    ...(isSelf ? [] : [{ action: 'role' as const, label: 'Đổi vai trò…' }]),
    { action: 'password', label: 'Đặt lại mật khẩu' },
    ...(isSelf
      ? []
      : [
          { action: 'lock' as const, label: user.isActive === false ? 'Mở khoá tài khoản' : 'Khoá tài khoản' },
          { action: 'delete' as const, label: 'Xoá tài khoản…', danger: true },
        ]),
  ];

  const place = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.bottom + 260 > window.innerHeight && r.top > 260;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, right: window.innerWidth - r.right, up });
  };

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    // Follow the trigger when the page or the table scrolls.
    document.addEventListener('mousedown', away);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(i + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={s.menuWrap} ref={wrap} onKeyDown={onKey}>
      <button
        ref={trigger}
        type="button"
        className={buttonClass({ variant: 'outline', size: 'sm', iconOnly: true })}
        aria-label={`Thao tác với ${user.email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          place();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          className={s.menu}
          role="menu"
          id={menuId}
          aria-label={`Thao tác với ${user.email}`}
          style={{ top: pos.top, right: pos.right, transform: pos.up ? 'translateY(-100%)' : undefined }}
        >
          {items.map((it) => (
            <button
              key={it.action}
              type="button"
              role="menuitem"
              className={it.danger ? s.danger : undefined}
              onClick={() => {
                setOpen(false);
                onPick(it.action);
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TITLES: Record<Action, (u: User | null) => string> = {
  create: () => 'Tạo tài khoản',
  edit: (u) => `Sửa thông tin ${u?.fullName ?? ''}`,
  role: (u) => `Đổi vai trò của ${u?.fullName ?? ''}`,
  password: (u) => `Đặt lại mật khẩu cho ${u?.fullName ?? ''}`,
  lock: (u) => (u?.isActive === false ? `Mở khoá ${u?.email}?` : `Khoá tài khoản ${u?.email}?`),
  delete: (u) => `Xoá tài khoản ${u?.email}?`,
};

function UserDialog({
  action,
  target,
  onClose,
  onDone,
}: {
  action: Action;
  target: User | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [fullName, setFullName] = useState(target?.fullName ?? '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(target?.phone ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(target?.role ?? 'STUDENT');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = target?.isActive === false;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (action === 'create') {
        await apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify({ fullName, email, password, role, phone: phone.trim() || undefined }),
        });
        onDone(`Đã tạo tài khoản ${email.trim().toLowerCase()}`);
      } else if (target && action === 'delete') {
        await apiRequest(`/users/${target.id}`, { method: 'DELETE' });
        onDone(`Đã xoá tài khoản ${target.email}`);
      } else if (target) {
        const body =
          action === 'edit'
            ? { fullName, phone }
            : action === 'role'
              ? { role }
              : action === 'password'
                ? { password }
                : { isActive: locked };
        await apiRequest(`/users/${target.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        onDone(
          action === 'edit'
            ? 'Đã lưu thông tin'
            : action === 'role'
              ? `Đã đổi vai trò thành ${ROLE[role].label}`
              : action === 'password'
                ? 'Đã đặt mật khẩu mới'
                : locked
                  ? `Đã mở khoá ${target.email}`
                  : `Đã khoá ${target.email}`,
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmLabel: Record<Action, string> = {
    create: 'Tạo tài khoản',
    edit: 'Lưu',
    role: 'Đổi vai trò',
    password: 'Đặt mật khẩu',
    lock: locked ? 'Mở khoá' : 'Khoá tài khoản',
    delete: 'Xoá vĩnh viễn',
  };
  const blocked =
    (action === 'delete' && confirmEmail.trim().toLowerCase() !== target?.email.toLowerCase()) ||
    (action === 'role' && role === target?.role);

  return (
    <Dialog
      open
      onClose={onClose}
      title={TITLES[action](target)}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            type="submit"
            form="user-dialog-form"
            variant={action === 'delete' || (action === 'lock' && !locked) ? 'danger' : 'ink'}
            size="sm"
            loading={busy}
            disabled={blocked}
          >
            {confirmLabel[action]}
          </Button>
        </>
      }
    >
      <form id="user-dialog-form" className={s.form} onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        {(action === 'create' || action === 'edit') && (
          <>
            <Field label="Họ và tên">
              <Input required minLength={2} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            {action === 'create' && (
              <Field label="Email">
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            )}
            <Field label="Số điện thoại (tuỳ chọn)">
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </>
        )}
        {(action === 'create' || action === 'password') && (
          <Field label={action === 'create' ? 'Mật khẩu' : 'Mật khẩu mới'} hint="Tối thiểu 6 ký tự. Gửi riêng cho người dùng.">
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        {(action === 'create' || action === 'role') && (
          <Field label="Vai trò">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE[r].label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {action === 'lock' && (
          <p style={{ margin: 0 }}>
            {locked
              ? 'Người này sẽ đăng nhập lại được với mật khẩu cũ.'
              : 'Người này sẽ không đăng nhập được nữa. Quyền xem khoá học và đơn hàng vẫn được giữ nguyên.'}
          </p>
        )}
        {action === 'delete' && target && (
          <>
            <p style={{ margin: 0 }}>
              Xoá vĩnh viễn tài khoản, tiến độ học và quyền xem khoá học của người này. Không hoàn tác được.
            </p>
            <Field label={`Gõ lại ${target.email} để xác nhận`}>
              <Input autoComplete="off" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
            </Field>
          </>
        )}
      </form>
    </Dialog>
  );
}
