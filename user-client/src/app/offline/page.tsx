import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui';
import { RetryButton } from '@/components/pwa/RetryButton';
import s from './offline.module.css';

export const metadata: Metadata = { title: 'Ngoại tuyến', robots: { index: false } };

/**
 * Shown by the service worker (public/sw.js) when a page cannot load
 * without a connection. Static: it is precached at install.
 */
export default function OfflinePage() {
  return (
    <div className={s.page}>
      <section className={s.panel} aria-labelledby="offline-title">
        <span className={s.kicker}>Mất kết nối</span>
        <span className={`han ${s.han}`} aria-hidden="true">
          断网
        </span>
        <h1 id="offline-title" className={s.title}>
          Bạn đang ngoại tuyến
        </h1>
        <p className={s.body}>
          Trang này cần kết nối mạng. Kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại. Bài bạn đang học vẫn được lưu.
        </p>
        <div className={s.actions}>
          <RetryButton />
          <LinkButton href="/" variant="outline">
            Về trang chủ
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
