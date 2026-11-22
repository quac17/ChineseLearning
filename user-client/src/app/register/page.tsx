'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, LinkButton } from '@/components/ui';
import { readNext, withNext } from '@/components/auth/useNext';
import s from '@/components/auth/auth.module.css';
import { useAuth } from '@/context/AuthContext';
import { routes } from '@/lib/courses';
import { useOnline } from '@/lib/useOnline';

export default function RegisterPage() {
  const router = useRouter();
  const { user, register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const online = useOnline();
  const [loginHref, setLoginHref] = useState('/login');

  useEffect(() => setLoginHref(withNext('/login')), []);

  const tooShort = password.length > 0 && password.length < 6;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      router.push(readNext() ?? routes.catalog());
    } catch (err) {
      setError((err as Error).message || 'Đăng ký thất bại.');
      setSubmitting(false);
    }
  };

  if (user && !submitting) {
    return (
      <div className={s.page}>
        <section className={s.panel}>
          <h1 className={s.title}>Bạn đã có tài khoản</h1>
          <p className={s.lead}>Đang đăng nhập bằng {user.email}.</p>
          <LinkButton href={readNext() ?? routes.myCourses} variant="ink" block>
            Tiếp tục
          </LinkButton>
        </section>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <form className={s.panel} onSubmit={onSubmit} aria-labelledby="register-title" noValidate>
        <h1 id="register-title" className={s.title}>
          Tạo tài khoản
        </h1>
        <p className={s.lead}>Miễn phí. Xem ngay các bài học thử, lưu tiến độ và từ đã nhớ.</p>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Họ và tên">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required minLength={2} />
        </Field>
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
        <Field label="Mật khẩu" hint="Tối thiểu 6 ký tự." error={tooShort ? 'Mật khẩu cần ít nhất 6 ký tự.' : undefined}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </Field>
        <Button
          type="submit"
          variant="accent"
          block
          loading={submitting}
          disabled={!online || fullName.trim().length < 2 || !email || password.length < 6}
        >
          Tạo tài khoản
        </Button>
        <p className={s.switch}>
          Đã có tài khoản? <Link href={loginHref}>Đăng nhập</Link>
        </p>
      </form>
    </div>
  );
}
