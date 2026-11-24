'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, LinkButton } from '@/components/ui';
import s from '@/components/auth/auth.module.css';
import { apiRequest } from '@/lib/api';
import { FEATURE_MAIL_ENABLED } from '@/lib/site';
import { useOnline } from '@/lib/useOnline';

/**
 * "Quên mật khẩu" then "Kiểm tra hộp thư" (WebAuth board). The second screen
 * always shows the same text, whether the email has an account or not, so the
 * page never reveals who is registered.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const online = useOnline();

  if (!FEATURE_MAIL_ENABLED) {
    return (
      <div className={s.page}>
        <section className={s.panel} aria-labelledby="disabled-mail-title">
          <h1 id="disabled-mail-title" className={s.title}>
            Tính năng tạm thời đang ẩn
          </h1>
          <p className={s.lead}>
            Tính năng đặt lại mật khẩu qua email đang tạm ngưng. Vui lòng liên hệ quản trị viên để được hỗ trợ đặt lại mật khẩu.
          </p>
          <LinkButton href="/login" variant="ink" block>
            Quay lại đăng nhập
          </LinkButton>
        </section>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSentTo(email.trim());
    } catch (err) {
      setError((err as Error).message || 'Không gửi được yêu cầu. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <div className={s.page}>
        <section className={s.panel} aria-labelledby="check-title">
          <h1 id="check-title" className={s.title}>
            Kiểm tra hộp thư
          </h1>
          <p className={s.text}>
            Nếu <b>{sentTo}</b> có tài khoản, bạn sẽ nhận email trong vài phút. Không thấy? Xem thư mục Spam.
          </p>
          <p className={s.note}>Đường dẫn trong email có hiệu lực 30 phút và chỉ dùng được một lần.</p>
          <Button type="button" variant="outline" block onClick={() => setSentTo(null)}>
            Gửi lại hoặc dùng email khác
          </Button>
          <Link href="/login" className={s.back}>
            Quay lại đăng nhập
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <form className={s.panel} onSubmit={onSubmit} aria-labelledby="forgot-title" noValidate>
        <h1 id="forgot-title" className={s.title}>
          Quên mật khẩu
        </h1>
        <p className={s.lead}>
          Nhập email đã đăng ký, chúng tôi gửi đường dẫn đặt lại mật khẩu (hiệu lực 30 phút).
        </p>
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
        <Button type="submit" variant="ink" block loading={submitting} disabled={!online || !email.trim()}>
          Gửi đường dẫn
        </Button>
        <Link href="/login" className={s.back}>
          Quay lại đăng nhập
        </Link>
      </form>
    </div>
  );
}
