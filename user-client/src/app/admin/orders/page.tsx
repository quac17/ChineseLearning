'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { formatVnd } from '@/lib/programs';
import type { AdminOrderDetail, AdminOrderItem, OrderStatus } from '@/lib/types';
import { AdminOnly } from '../AdminOnly';
import s from '../admin.module.css';

const STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Chờ thanh toán', tone: 'warning' },
  PAID: { label: 'Đã thanh toán', tone: 'success' },
  EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  CANCELLED: { label: 'Đã huỷ', tone: 'neutral' },
  REFUNDED: { label: 'Đã hoàn tiền', tone: 'info' },
};

const EVENT_KIND: Record<string, string> = {
  CREATED: 'Tạo đơn',
  WEBHOOK: 'Webhook',
  RECONCILE: 'Đối soát',
  EXPIRED: 'Hết hạn',
  ADMIN_GRANT: 'Cấp quyền thủ công',
  ADMIN_REFUND: 'Hoàn tiền',
};

const time = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export default function AdminOrdersPage() {
  return (
    <AdminOnly>
      <Orders />
    </AdminOnly>
  );
}

function Orders() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [orders, setOrders] = useState<AdminOrderItem[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    if (needsReview) params.set('needsReview', 'true');
    try {
      setOrders(await apiRequest<AdminOrderItem[]>(`/payments/admin/orders?${params}`));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được đơn hàng.');
    }
  }, [q, status, needsReview]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Đơn hàng</h1>
          <p className={s.sub}>Đơn PayOS: tra cứu, xem lịch sử webhook, cấp quyền thủ công, ghi nhận hoàn tiền.</p>
        </div>
        <div className={s.filters} role="search">
          <label htmlFor="order-q" className="sr-only">
            Tìm đơn
          </label>
          <Input
            id="order-q"
            type="search"
            placeholder="Mã đơn VK-…, email, khoá"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label htmlFor="order-status" className="sr-only">
            Trạng thái
          </label>
          <Select id="order-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Mọi trạng thái</option>
            {(Object.keys(STATUS) as OrderStatus[]).map((k) => (
              <option key={k} value={k}>
                {STATUS[k].label}
              </option>
            ))}
          </Select>
          <Checkbox label="Cần kiểm tra" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} />
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={s.layout}>
        <section className={`${s.card} ${s.listCard}`} aria-label="Danh sách đơn">
          {!orders ? (
            <div className={s.state}>
              <Skeleton height={200} />
            </div>
          ) : orders.length === 0 ? (
            <div className={s.state}>
              <EmptyState title="Không có đơn nào">Thử bỏ bớt bộ lọc.</EmptyState>
            </div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Mã đơn</th>
                  <th scope="col">Học viên</th>
                  <th scope="col">Khoá</th>
                  <th scope="col">Số tiền</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className={s.rowButton}
                    data-selected={selected === o.id}
                    onClick={() => setSelected(o.id)}
                  >
                    <td className={s.nowrap}>
                      <button
                        type="button"
                        onClick={() => setSelected(o.id)}
                        style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'inherit', cursor: 'pointer' }}
                      >
                        {o.code}
                      </button>
                    </td>
                    <td>{o.userEmail}</td>
                    <td>{o.courseTitle}</td>
                    <td className={s.nowrap}>{formatVnd(o.amountVnd)}</td>
                    <td className={s.nowrap}>
                      <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                      {o.needsReview && (
                        <>
                          {' '}
                          <Badge tone="error">Cần kiểm tra</Badge>
                        </>
                      )}
                    </td>
                    <td className={s.nowrap}>{time(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {selected && <OrderDetail id={selected} onChanged={load} />}
      </div>
    </div>
  );
}

function OrderDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const toast = useToast();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'grant' | 'refund' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOrder(null);
    apiRequest<AdminOrderDetail>(`/payments/admin/orders/${id}`)
      .then((d) => !cancelled && setOrder(d))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const run = async () => {
    if (!action) return;
    setBusy(true);
    try {
      const updated = await apiRequest<AdminOrderDetail>(`/payments/admin/orders/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      setOrder(updated);
      toast.show(action === 'grant' ? 'Đã cấp quyền xem khoá học' : 'Đã ghi nhận hoàn tiền và thu hồi quyền');
      setAction(null);
      setNote('');
      onChanged();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <aside className={`${s.card} ${s.detail}`}>
        <Alert tone="error">{error}</Alert>
      </aside>
    );
  }
  if (!order) {
    return (
      <aside className={`${s.card} ${s.detail}`} aria-busy="true">
        <Skeleton height={260} />
      </aside>
    );
  }

  const canGrant = order.status !== 'REFUNDED' && (order.needsReview || order.status !== 'PAID');
  const canRefund = order.status === 'PAID';

  return (
    <aside className={`${s.card} ${s.detail}`} aria-labelledby="order-detail-title">
      <h2 id="order-detail-title">Đơn {order.code}</h2>
      <div>
        <div className={s.kv}>
          <span className={s.muted}>Học viên</span>
          <b>
            {order.userName ? `${order.userName} · ` : ''}
            {order.userEmail}
          </b>
        </div>
        <div className={s.kv}>
          <span className={s.muted}>Khoá</span>
          <b>{order.courseTitle}</b>
        </div>
        <div className={s.kv}>
          <span className={s.muted}>Số tiền</span>
          <b>{formatVnd(order.amountVnd)}</b>
        </div>
        <div className={s.kv}>
          <span className={s.muted}>Mã gửi cổng thanh toán</span>
          <b>
            {order.orderCode} ({order.gateway === 'FAKE' ? 'giả lập' : 'PayOS'})
          </b>
        </div>
        <div className={s.kv}>
          <span className={s.muted}>Trạng thái</span>
          <b>
            <Badge tone={STATUS[order.status].tone}>{STATUS[order.status].label}</Badge>
          </b>
        </div>
      </div>

      {order.needsReview && (
        <Alert tone="error">
          Có khoản tiền chưa khớp với đơn này (xem lịch sử). Kiểm tra trên PayOS/ngân hàng rồi cấp quyền thủ công hoặc
          xử lý hoàn tiền.
        </Alert>
      )}

      <h3>Lịch sử</h3>
      <ol className={s.events}>
        {order.events.map((e) => (
          <li key={e.id} className={s.event}>
            <span className={s.muted}>{time(e.createdAt)}</span>
            <span>
              <b>{EVENT_KIND[e.kind] ?? e.kind}</b>
              {e.message ? `: ${e.message}` : ''}
              {e.actorName ? ` (${e.actorName})` : ''}
            </span>
          </li>
        ))}
      </ol>

      {(canGrant || canRefund) && (
        <div className={s.actions}>
          {canGrant && (
            <Button variant="ink" size="sm" onClick={() => setAction('grant')}>
              Cấp quyền thủ công
            </Button>
          )}
          {canRefund && (
            <Button variant="outline" size="sm" onClick={() => setAction('refund')}>
              Đánh dấu hoàn tiền
            </Button>
          )}
        </div>
      )}
      <p className={s.note}>
        Mọi thao tác thủ công được ghi vào lịch sử kèm tên admin. Hoàn tiền thực hiện ở ngân hàng/PayOS; nút này chỉ ghi
        nhận và thu hồi quyền.
      </p>

      <Dialog
        open={action !== null}
        onClose={() => setAction(null)}
        title={action === 'grant' ? `Cấp quyền cho đơn ${order.code}?` : `Ghi nhận hoàn tiền đơn ${order.code}?`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setAction(null)}>
              Huỷ
            </Button>
            <Button variant={action === 'refund' ? 'danger' : 'ink'} size="sm" loading={busy} onClick={run}>
              {action === 'grant' ? 'Cấp quyền' : 'Ghi nhận hoàn tiền'}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {action === 'grant'
            ? `Chỉ cấp khi đã kiểm tra tiền về đủ ${formatVnd(order.amountVnd)}. Học viên sẽ xem được khoá ngay.`
            : 'Học viên sẽ mất quyền xem khoá này. Tiền phải được hoàn ở ngân hàng/PayOS trước.'}
        </p>
        <Field label="Ghi chú (tuỳ chọn)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
        </Field>
      </Dialog>
    </aside>
  );
}
