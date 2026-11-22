'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, LinkButton, Skeleton } from '@/components/ui';
import s from '@/components/auth/auth.module.css';
import { apiRequest } from '@/lib/api';
import { useOnline } from '@/lib/useOnline';

/**
 * Set a new password from the mailed link `/reset-password#token=…`. The
 * token sits in the fragment (never sent to a server or in a Referer) and is
 * removed from the address bar as soon as it is read.
 */
export default function ResetPasswordPage() {
  // undefined = not read yet, null = no token in the link.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const online = useOnline();

  useEffect(() => {
    const found = new URLSearchParams(window.location.hash.slice(1)).get('token');
    setToken(found && found.length >= 20 ? found : null);
    if (found) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && confirm !== password;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError('');
    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest<{ reset: true }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message || 'Không đặt lại được mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (token === undefined) {
    return (
      <div className={s.page} aria-busy="true" aria-label="Đang mở đường dẫn">
        <div className={s.panel}>
          <Skeleton width={220} height={32} />
          <Skeleton height={120} />
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={s.page}>
        <section className={s.panel} aria-labelledby="done-title">
          <h1 id="done-title" className={s.title}>
            Đã đặt lại mật khẩu
          </h1>
          <p className={s.text}>Mật khẩu mới đã được lưu. Đăng nhập bằng mật khẩu mới để tiếp tục học.</p>
          <LinkButton href="/login" variant="ink" block>
            Đăng nhập
          </LinkButton>
        </section>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={s.page}>
        <section className={s.panel} aria-labelledby="invalid-title">
          <h1 id="invalid-title" className={s.title}>
            Đường dẫn không hợp lệ
          </h1>
          <p className={s.text}>
            Đường dẫn đặt lại mật khẩu bị thiếu hoặc sai. Hãy mở lại đường dẫn trong email, hoặc yêu cầu đường dẫn mới.
          </p>
          <LinkButton href="/forgot-password" variant="ink" block>
            Yêu cầu đường dẫn mới
          </LinkButton>
          <Link href="/login" className={s.back}>
            Quay lại đăng nhập
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <form className={s.panel} onSubmit={onSubmit} aria-labelledby="reset-title" noValidate>
        <h1 id="reset-title" className={s.title}>
          Đặt mật khẩu mới
        </h1>
        <p className={s.lead}>Chọn mật khẩu mới cho tài khoản Vân Kính của bạn.</p>
        {error && (
          <Alert tone="error">
            {error} <Link href="/forgot-password">Yêu cầu đường dẫn mới</Link>
          </Alert>
        )}
        <Field label="Mật khẩu mới" hint="Tối thiểu 6 ký tự." error={tooShort ? 'Mật khẩu cần ít nhất 6 ký tự.' : undefined}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </Field>
        <Field label="Nhập lại mật khẩu mới" error={mismatch ? 'Chưa khớp với mật khẩu mới.' : undefined}>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </Field>
        <Button
          type="submit"
          variant="ink"
          block
          loading={submitting}
          disabled={!online || password.length < 6 || confirm !== password}
        >
          Lưu mật khẩu mới
        </Button>
        <Link href="/login" className={s.back}>
          Quay lại đăng nhập
        </Link>
      </form>
    </div>
  );
}
