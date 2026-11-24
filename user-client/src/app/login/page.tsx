'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, LinkButton } from '@/components/ui';
import { readNext, withNext } from '@/components/auth/useNext';
import s from '@/components/auth/auth.module.css';
import { useAuth } from '@/context/AuthContext';
import { routes } from '@/lib/courses';
import { FEATURE_MAIL_ENABLED } from '@/lib/site';
import { useOnline } from '@/lib/useOnline';

/**
 * Seed accounts (demo-only passwords from the README), as one-click fills.
 * Shown on the dev server only: never advertise demo credentials in production.
 */
const DEMO_ACCOUNTS =
  process.env.NODE_ENV === 'development'
    ? [
        { label: 'Admin', email: 'admin@chineselearner.vn', pass: 'Admin@123' },
        { label: 'Giáo viên', email: 'teacher@chineselearner.vn', pass: 'Teacher@123' },
        { label: 'Học sinh A (Có quyền HSK 1)', email: 'studentA@chineselearner.vn', pass: 'Student@123' },
        { label: 'Học sinh B (Chưa cấp quyền)', email: 'studentB@chineselearner.vn', pass: 'Student@123' },
      ]
    : [];

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const online = useOnline();
  const [registerHref, setRegisterHref] = useState('/register');

  useEffect(() => setRegisterHref(withNext('/register')), []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const u = await login(email, password);
      // ?next= brings the learner back (e.g. to the course they wanted to buy).
      const next = readNext();
      if (next) router.push(next);
      else if (u.role === 'ADMIN') router.push('/admin');
      else if (u.role === 'TEACHER') router.push('/teacher');
      else router.push(routes.catalog());
    } catch (err) {
      setError((err as Error).message || 'Đăng nhập thất bại.');
      setSubmitting(false);
    }
  };

  if (user && !submitting) {
    return (
      <div className={s.page}>
        <section className={s.panel}>
          <h1 className={s.title}>Bạn đã đăng nhập</h1>
          <p className={s.lead}>Đang dùng tài khoản {user.email}.</p>
          <LinkButton href={readNext() ?? routes.myCourses} variant="ink" block>
            Tiếp tục
          </LinkButton>
        </section>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <form className={s.panel} onSubmit={onSubmit} aria-labelledby="login-title" noValidate>
        <h1 id="login-title" className={s.title}>
          Đăng nhập
        </h1>
        <p className={s.lead}>Tiếp tục học từ bài bạn đang dở.</p>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="ban@email.com"
          />
        </Field>
        {/* The link sits outside the <label>, so the field keeps the accessible name "Mật khẩu". */}
        <div className={s.passwordField}>
          <Field label="Mật khẩu">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          {FEATURE_MAIL_ENABLED && (
            <Link href="/forgot-password" className={s.forgot}>
              Quên mật khẩu?
            </Link>
          )}
        </div>
        <Button type="submit" variant="ink" block loading={submitting} disabled={!online || !email || !password}>
          Đăng nhập
        </Button>
        <p className={s.switch}>
          Chưa có tài khoản? <Link href={registerHref}>Đăng ký</Link>
        </p>

        {DEMO_ACCOUNTS.length > 0 && (
          <div className={s.demo}>
            <p>Tài khoản mẫu (chỉ hiện trên máy dev):</p>
            <div className={s.demoButtons}>
              {DEMO_ACCOUNTS.map((acc) => (
                <Button
                  key={acc.email}
                  type="button"
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.pass);
                  }}
                >
                  {acc.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
