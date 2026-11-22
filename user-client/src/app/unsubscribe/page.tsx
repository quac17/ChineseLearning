'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Button, LinkButton, Skeleton } from '@/components/ui';
import s from '@/components/auth/auth.module.css';
import { apiRequest } from '@/lib/api';

/**
 * Turns the daily review reminder off from the link in the mail
 * (/unsubscribe?u=<user id>&s=<signature>), without logging in. A button,
 * not an automatic call on load: mail scanners open links, and that must not
 * unsubscribe anyone.
 */
export default function UnsubscribePage() {
  // undefined = not read yet, null = the link is incomplete.
  const [link, setLink] = useState<{ u: string; s: string } | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get('u');
    const sig = params.get('s');
    setLink(u && sig ? { u, s: sig } : null);
  }, []);

  const onConfirm = async () => {
    if (!link) return;
    setError('');
    setSubmitting(true);
    try {
      const qs = `u=${encodeURIComponent(link.u)}&s=${encodeURIComponent(link.s)}`;
      await apiRequest<{ enabled: false }>(`/reminders/unsubscribe?${qs}`, { method: 'POST' });
      setDone(true);
    } catch (err) {
      setError((err as Error).message || 'Không tắt được nhắc ôn tập.');
    } finally {
      setSubmitting(false);
    }
  };

  if (link === undefined) {
    return (
      <div className={s.page} aria-busy="true" aria-label="Đang mở đường dẫn">
        <div className={s.panel}>
          <Skeleton width={220} height={32} />
          <Skeleton height={100} />
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={s.page}>
        <section className={s.panel} aria-labelledby="unsub-done-title">
          <h1 id="unsub-done-title" className={s.title}>
            Đã tắt nhắc ôn tập
          </h1>
          <p className={s.text}>Bạn sẽ không nhận email nhắc ôn tập mỗi ngày nữa. Muốn nhận lại, bật trong trang Tài khoản.</p>
          <LinkButton href="/account#nhac-on-tap" variant="outline" block>
            Mở trang Tài khoản
          </LinkButton>
        </section>
      </div>
    );
  }

  if (!link) {
    return (
      <div className={s.page}>
        <section className={s.panel} aria-labelledby="unsub-invalid-title">
          <h1 id="unsub-invalid-title" className={s.title}>
            Đường dẫn không hợp lệ
          </h1>
          <p className={s.text}>
            Đường dẫn huỷ nhận nhắc ôn tập bị thiếu. Bạn có thể tắt &quot;Nhắc ôn tập mỗi ngày&quot; trong trang Tài khoản.
          </p>
          <LinkButton href="/account#nhac-on-tap" variant="ink" block>
            Mở trang Tài khoản
          </LinkButton>
        </section>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <section className={s.panel} aria-labelledby="unsub-title">
        <h1 id="unsub-title" className={s.title}>
          Tắt nhắc ôn tập?
        </h1>
        <p className={s.lead}>
          Bạn sẽ không nhận email &quot;Hôm nay bạn có từ cần ôn&quot; nữa. Từ đến hạn vẫn nằm trong mục Ôn tập.
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="button" variant="ink" block loading={submitting} onClick={onConfirm}>
          Tắt nhắc ôn tập
        </Button>
        <Link href="/flashcards?due=true" className={s.back}>
          Ôn từ đến hạn ngay
        </Link>
      </section>
    </div>
  );
}
