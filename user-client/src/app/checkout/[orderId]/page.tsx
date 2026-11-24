'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, EmptyState, LinkButton, Skeleton, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import { formatVnd } from '@/lib/programs';
import { FEATURE_PAYOS_ENABLED, SUPPORT_CONTACT } from '@/lib/site';
import type { OrderItem } from '@/lib/types';
import s from '../checkout.module.css';

/** How often the page asks the server while the order is unpaid. */
const POLL_MS = 3000;

export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderItem | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setOrder(await apiRequest<OrderItem>(`/payments/orders/${encodeURIComponent(orderId)}`));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được đơn hàng.');
    }
  }, [orderId]);

  useEffect(() => {
    if (!FEATURE_PAYOS_ENABLED || authLoading || !user) return;
    load();
  }, [authLoading, user, load]);

  if (!FEATURE_PAYOS_ENABLED) {
    return (
      <div className={s.page}>
        <EmptyState
          title="Tính năng thanh toán tạm thời đang ẩn"
          action={
            <LinkButton href={routes.catalog()} variant="ink">
              Xem danh sách khoá học
            </LinkButton>
          }
        >
          Vui lòng liên hệ giáo viên phụ trách hoặc quản trị viên để được mở khoá khoá học cho tài khoản của bạn.
        </EmptyState>
      </div>
    );
  }

  // Poll while unpaid. The page never decides the outcome itself: the server
  // marks the order paid from the gateway's signed webhook (or reconciliation).
  const pending = order?.status === 'PENDING';
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, load]);

  if (authLoading) return <PageSkeleton />;
  if (!user) {
    return (
      <div className={s.page}>
        <EmptyState
          title="Đăng nhập để xem đơn hàng"
          action={
            <LinkButton href={routes.login(`/checkout/${orderId}`)} variant="ink">
              Đăng nhập
            </LinkButton>
          }
        />
      </div>
    );
  }
  if (error && !order) {
    return (
      <div className={s.page}>
        <EmptyState
          title="Không tìm thấy đơn hàng"
          action={
            <LinkButton href={routes.account} variant="outline">
              Xem đơn hàng của tôi
            </LinkButton>
          }
        >
          {error}
        </EmptyState>
      </div>
    );
  }
  if (!order) return <PageSkeleton />;

  return (
    <div className={s.page}>
      {order.status === 'PENDING' && <PendingPanel order={order} onChanged={setOrder} reload={load} />}
      {order.status === 'PAID' && <PaidPanel order={order} />}
      {(order.status === 'EXPIRED' || order.status === 'CANCELLED') && <ExpiredPanel order={order} />}
      {order.status === 'REFUNDED' && (
        <section className={s.panel}>
          <h1 className={s.title}>Đơn đã hoàn tiền</h1>
          <p className={s.muted}>
            Đơn <span className={s.code}>{order.code}</span> cho khoá <b>{order.courseTitle}</b> đã được hoàn tiền và
            quyền xem đã đóng.
          </p>
          <LinkButton href={routes.account} variant="outline">
            Xem đơn hàng của tôi
          </LinkButton>
        </section>
      )}
      <SupportLine code={order.code} />
    </div>
  );
}

function PendingPanel({
  order,
  onChanged,
  reload,
}: {
  order: OrderItem;
  onChanged: (o: OrderItem) => void;
  reload: () => Promise<void>;
}) {
  const toast = useToast();
  const [qrSrc, setQrSrc] = useState('');
  const [simulating, setSimulating] = useState(false);
  const left = useCountdown(order.expiresAt);
  const cancelledOnGateway =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('huy');

  useEffect(() => {
    if (!order.qrCode) return;
    QRCode.toDataURL(order.qrCode, { margin: 1, width: 440, errorCorrectionLevel: 'M' })
      .then(setQrSrc)
      .catch(() => setQrSrc(''));
  }, [order.qrCode]);

  // Expiry is decided by the server; ask it as soon as the clock runs out.
  useEffect(() => {
    if (left === 0) reload();
  }, [left, reload]);

  const simulate = async () => {
    setSimulating(true);
    try {
      onChanged(await apiRequest<OrderItem>(`/payments/orders/${order.id}/simulate-paid`, { method: 'POST' }));
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <section className={s.panel} aria-labelledby="pay-title">
      <h1 id="pay-title" className={s.title}>
        Thanh toán khoá học
      </h1>
      <CourseLine order={order} />
      <div>
        <div className={`${s.kv} ${s.kvPrice}`}>
          <span>Giá khoá học</span>
          <b>{formatVnd(order.amountVnd)}</b>
        </div>
        {/* Price and total are equal (no discounts); phones show the total only. */}
        <div className={s.kv} style={{ borderBottom: 0 }}>
          <b>Tổng thanh toán</b>
          <b>{formatVnd(order.amountVnd)}</b>
        </div>
      </div>

      {cancelledOnGateway && (
        <Alert tone="info">Bạn đã quay lại từ trang PayOS. Mã QR dưới đây vẫn dùng được cho tới khi hết hạn.</Alert>
      )}

      <div className={s.pay}>
        <div className={s.qr}>
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrSrc} alt={`Mã VietQR thanh toán ${formatVnd(order.amountVnd)} cho đơn ${order.code}`} />
          ) : (
            <Skeleton height="100%" />
          )}
        </div>
        <div className={s.payText}>
          <b className={s.wideOnly}>Quét mã bằng app ngân hàng</b>
          <span className={s.wideOnly}>Số tiền và nội dung chuyển khoản đã có sẵn trong mã, bạn không cần gõ lại.</span>
          <span className={s.phoneOnly}>
            {order.checkoutUrl
              ? 'Lưu ảnh mã rồi mở app ngân hàng để quét, hoặc bấm nút dưới để mở thẳng app ngân hàng.'
              : 'Lưu ảnh mã rồi mở app ngân hàng để quét. Số tiền và nội dung chuyển khoản đã có sẵn trong mã.'}
          </span>
          <span className={s.muted} aria-live="off">
            Mã hết hạn sau <b className={s.timer}>{formatLeft(left)}</b>
            <span className={s.phoneOnly}> · Đơn {order.code}</span>
          </span>
          <span className={s.waiting} role="status">
            <span className={s.spinner} aria-hidden="true" />
            Đang chờ xác nhận
          </span>
          <span className={s.muted}>Trang tự cập nhật khi nhận được tiền.</span>
          <div className={`${s.actions} ${s.wideOnly}`}>
            {order.checkoutUrl && (
              <LinkButton href={order.checkoutUrl} variant="outline" size="sm" rel="noopener">
                Mở trang thanh toán PayOS
              </LinkButton>
            )}
            {qrSrc && (
              <LinkButton href={qrSrc} variant="subtle" size="sm" download={`${order.code}.png`}>
                Lưu mã QR
              </LinkButton>
            )}
          </div>
        </div>
      </div>

      {/* Phone (AppCheckout board): nobody can scan a QR shown on their own
          screen, so opening the bank app through PayOS comes first. */}
      <div className={s.payBar} data-testid="mobile-pay-actions">
        {order.checkoutUrl && (
          <LinkButton href={order.checkoutUrl} variant="accent" block rel="noopener">
            Mở app ngân hàng
          </LinkButton>
        )}
        {qrSrc && (
          <LinkButton
            href={qrSrc}
            variant={order.checkoutUrl ? 'outline' : 'ink'}
            block
            download={`${order.code}.png`}
          >
            Lưu mã QR
          </LinkButton>
        )}
      </div>

      {order.canSimulate && (
        <div className={s.dev}>
          <span>
            <Badge tone="warning">Môi trường thử</Badge> Đây là cổng thanh toán giả lập: mã QR trên không chuyển được tiền.
            Bấm nút dưới để giả lập ngân hàng báo đã nhận tiền (gửi webhook có chữ ký như PayOS).
          </span>
          <div>
            <Button variant="ink" size="sm" loading={simulating} onClick={simulate}>
              Giả lập: đã thanh toán
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function PaidPanel({ order }: { order: OrderItem }) {
  return (
    <section className={s.panel} aria-labelledby="ok-title">
      <h1 id="ok-title" className={s.title}>
        Thanh toán thành công
      </h1>
      <CourseLine order={order} />
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
        Khoá <b>{order.courseTitle}</b> đã mở trên tài khoản của bạn.
      </p>
      <div className={s.actions}>
        {order.courseId && (
          <LinkButton href={routes.learn(order.courseId)} variant="ink">
            Vào học ngay
          </LinkButton>
        )}
        <LinkButton href={routes.myCourses} variant="outline">
          Xem khoá học của tôi
        </LinkButton>
      </div>
    </section>
  );
}

function ExpiredPanel({ order }: { order: OrderItem }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const renew = async () => {
    if (!order.courseId) return;
    setBusy(true);
    try {
      const next = await apiRequest<OrderItem>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ courseId: order.courseId }),
      });
      router.replace(routes.checkout(next.id));
    } catch (err) {
      toast.show((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <section className={s.panel} aria-labelledby="exp-title">
      <h1 id="exp-title" className={s.title}>
        Mã QR đã hết hạn
      </h1>
      <CourseLine order={order} />
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
        Chưa có khoản tiền nào được ghi nhận cho đơn này. Nếu bạn đã chuyển khoản, đừng chuyển lại: hãy gửi mã đơn{' '}
        <span className={s.code}>{order.code}</span> cho chúng tôi để kiểm tra.
      </p>
      <div className={s.actions}>
        {order.courseId && (
          <Button variant="accent" loading={busy} onClick={renew}>
            Tạo mã mới
          </Button>
        )}
        {order.courseId && (
          <LinkButton href={routes.course(order.courseId)} variant="outline">
            Về trang khoá học
          </LinkButton>
        )}
      </div>
    </section>
  );
}

function CourseLine({ order }: { order: OrderItem }) {
  return (
    <div className={s.course}>
      <div>
        <p className={s.courseTitle}>
          {order.courseId ? <Link href={routes.course(order.courseId)}>{order.courseTitle}</Link> : order.courseTitle}
        </p>
        <p className={s.muted}>
          Đơn <span className={s.code}>{order.code}</span> · Xem trọn đời
        </p>
      </div>
    </div>
  );
}

function SupportLine({ code }: { code: string }) {
  if (!SUPPORT_CONTACT) return null;
  return (
    <p className={s.muted}>
      Gặp sự cố? Gửi mã đơn <span className={s.code}>{code}</span> cho {SUPPORT_CONTACT}.
    </p>
  );
}

/** Seconds left until `iso`, ticking every second; 0 when past. */
function useCountdown(iso: string): number {
  const calc = () => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);
  return left;
}

function formatLeft(sec: number): string {
  const m = Math.floor(sec / 60);
  const s2 = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;
}

function PageSkeleton() {
  return (
    <div className={s.page} aria-busy="true" aria-label="Đang tải đơn hàng">
      <section className={s.panel}>
        <Skeleton width="60%" height={28} />
        <Skeleton height={60} />
        <Skeleton height={220} />
      </section>
    </div>
  );
}
