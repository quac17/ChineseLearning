import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PoolClient } from 'pg';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId, Role } from '../common/types/domain.types';
import { CoursesService } from '../courses/courses.service';
import { DatabaseService } from '../database/database.service';
import { FakeGateway } from './gateways/fake.gateway';
import { InvalidSignatureError, PAYMENT_GATEWAY, PaidNotice, PaymentGateway } from './gateways/payment-gateway';

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';

/** How long a QR code stays payable. */
const ORDER_TTL_MS = 15 * 60 * 1000;
/** Reuse a pending order only if at least this much time is left on it. */
const REUSE_MIN_LEFT_MS = 2 * 60 * 1000;
/** Ask the gateway about a pending order at most this often. */
const RECONCILE_EVERY_MS = 5 * 1000;

export type PaidOutcome =
  | 'GRANTED'
  | 'DUPLICATE'
  | 'ALREADY_PAID'
  | 'AMOUNT_MISMATCH'
  | 'AFTER_REFUND'
  | 'UNKNOWN_ORDER';

/** "VK-1000001": the order code shown to learners and support. */
export const displayCode = (orderCode: number | string) => `VK-${orderCode}`;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly courses: CoursesService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /** The dev-only "simulate payment" button exists only with the fake gateway. */
  get canSimulate(): boolean {
    return this.gateway instanceof FakeGateway;
  }

  // ---------------------------------------------------------------------------
  // Learner
  // ---------------------------------------------------------------------------

  async checkout(user: AuthUser, courseId: string) {
    const course = await this.db.queryOne(
      'SELECT id, title, is_free, is_published, price_vnd FROM courses WHERE id = $1',
      [courseId],
    );
    if (!course || !course.is_published) throw new NotFoundException('Không tìm thấy khoá học.');
    if (course.is_free) throw new BadRequestException('Khoá học này miễn phí, bạn có thể vào học ngay.');
    if (!course.price_vnd) throw new BadRequestException('Khoá học này chưa mở bán.');
    if (await this.courses.checkUserCourseAccess(courseId, user)) {
      throw new BadRequestException('Bạn đã có quyền xem khoá học này.');
    }

    const reusable = await this.db.queryOne(
      `SELECT * FROM orders
       WHERE user_id = $1 AND course_id = $2 AND status = 'PENDING'
         AND amount_vnd = $3 AND expires_at > now() + ($4 || ' milliseconds')::interval
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, courseId, course.price_vnd, String(REUSE_MIN_LEFT_MS)],
    );
    if (reusable) return this.toLearnerOrder(reusable);

    const id = generateId('order');
    const expiresAt = new Date(Date.now() + ORDER_TTL_MS);
    const created = await this.db.queryOne(
      `INSERT INTO orders (id, user_id, course_id, user_email, course_title, amount_vnd, gateway, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, user.id, courseId, user.email, course.title, course.price_vnd, this.gateway.name, expiresAt],
    );
    const orderCode = Number(created.order_code);
    const appUrl = (this.config.get<string>('APP_URL') || 'http://localhost:3000').replace(/\/$/, '');

    try {
      const link = await this.gateway.createCheckout({
        orderId: id,
        orderCode,
        amountVnd: created.amount_vnd,
        description: `VK${orderCode}`,
        itemName: course.title,
        expiresAt,
        returnUrl: `${appUrl}/checkout/${id}`,
        cancelUrl: `${appUrl}/checkout/${id}?huy=1`,
      });
      const updated = await this.db.queryOne(
        `UPDATE orders SET checkout_url = $1, qr_code = $2, gateway_link_id = $3, updated_at = now()
         WHERE id = $4 RETURNING *`,
        [link.checkoutUrl, link.qrCode, link.gatewayLinkId, id],
      );
      await this.logEvent(this.db, { orderId: id, kind: 'CREATED', outcome: 'OK', message: 'Tạo đơn, sinh mã QR' });
      return this.toLearnerOrder(updated);
    } catch (err) {
      await this.db.query(`UPDATE orders SET status = 'CANCELLED', updated_at = now() WHERE id = $1`, [id]);
      await this.logEvent(this.db, {
        orderId: id,
        kind: 'CREATED',
        outcome: 'GATEWAY_ERROR',
        message: (err as Error).message,
      });
      throw err;
    }
  }

  /** One order as its owner (or an admin) sees it. Reconciles pending orders. */
  async getOrder(user: AuthUser, orderId: string) {
    let order = await this.loadOrderFor(user, orderId);
    if (order.status === 'PENDING') order = await this.refreshPending(order);
    return this.toLearnerOrder(order);
  }

  async listMine(user: AuthUser) {
    await this.expireOverdue();
    const rows = await this.db.queryAll(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [user.id],
    );
    return rows.map((r) => this.toLearnerOrder(r, { withQr: false }));
  }

  /** Dev only: pretend the bank paid, through the real webhook path. */
  async simulatePaid(user: AuthUser, orderId: string) {
    if (!(this.gateway instanceof FakeGateway)) {
      throw new ForbiddenException('Chỉ dùng được với cổng thanh toán giả lập.');
    }
    const order = await this.loadOrderFor(user, orderId);
    const body = this.gateway.buildPaidWebhook(Number(order.order_code), order.amount_vnd, `FAKE-${Date.now()}`);
    await this.handleWebhook(body);
    return this.getOrder(user, orderId);
  }

  // ---------------------------------------------------------------------------
  // Gateway → us
  // ---------------------------------------------------------------------------

  /**
   * Webhook entry. Throws InvalidSignatureError (→ 400) for a bad signature;
   * everything else is acknowledged so the gateway stops retrying.
   */
  async handleWebhook(body: unknown): Promise<{ outcome: PaidOutcome | 'NOT_PAID' }> {
    let notice: PaidNotice | null;
    try {
      notice = this.gateway.verifyWebhook(body);
    } catch (err) {
      if (err instanceof InvalidSignatureError) {
        this.logger.warn('Webhook rejected: invalid signature');
      }
      throw err;
    }
    if (!notice) return { outcome: 'NOT_PAID' };
    const outcome = await this.applyPaid(notice, 'WEBHOOK', body);
    return { outcome };
  }

  /**
   * Marks an order paid and opens the course, in one transaction. Safe to
   * repeat: duplicates, late and out-of-order notices end in a no-op.
   */
  async applyPaid(notice: PaidNotice, kind: 'WEBHOOK' | 'RECONCILE', payload: unknown): Promise<PaidOutcome> {
    const eventKey = notice.reference ? `ref:${notice.reference}` : `paid:${notice.orderCode}`;
    return this.db.withTransaction(async (tx) => {
      const order = (
        await tx.query('SELECT * FROM orders WHERE order_code = $1 FOR UPDATE', [notice.orderCode])
      ).rows[0];

      const inserted = await tx.query(
        `INSERT INTO payment_events (id, order_id, gateway, kind, event_key, outcome, payload)
         VALUES ($1, $2, $3, $4, $5, 'RECEIVED', $6)
         ON CONFLICT (gateway, event_key) WHERE event_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [generateId('pev'), order?.id ?? null, this.gateway.name, kind, eventKey, JSON.stringify(payload ?? null)],
      );
      if (inserted.rowCount === 0) return 'DUPLICATE';
      const eventId = inserted.rows[0].id;
      const finish = async (outcome: PaidOutcome, message: string) => {
        await tx.query('UPDATE payment_events SET outcome = $1, message = $2 WHERE id = $3', [outcome, message, eventId]);
        return outcome;
      };

      if (!order) return finish('UNKNOWN_ORDER', `Không có đơn với mã ${notice.orderCode}`);
      if (order.status === 'PAID') return finish('ALREADY_PAID', 'Đơn đã thanh toán trước đó');

      if (order.status === 'REFUNDED') {
        await tx.query('UPDATE orders SET needs_review = true, updated_at = now() WHERE id = $1', [order.id]);
        return finish('AFTER_REFUND', 'Nhận tiền cho đơn đã hoàn tiền: cần kiểm tra');
      }

      if (notice.amountVnd < order.amount_vnd) {
        await tx.query('UPDATE orders SET needs_review = true, updated_at = now() WHERE id = $1', [order.id]);
        return finish(
          'AMOUNT_MISMATCH',
          `Nhận ${notice.amountVnd} ₫, đơn cần ${order.amount_vnd} ₫: chưa cấp quyền`,
        );
      }

      // PENDING, or EXPIRED/CANCELLED but the money arrived anyway: open the course.
      await tx.query(
        `UPDATE orders SET status = 'PAID', paid_at = now(), needs_review = false, updated_at = now() WHERE id = $1`,
        [order.id],
      );
      await this.grantAccess(tx, order, null, `PayOS ${displayCode(order.order_code)}`);
      return finish('GRANTED', kind === 'WEBHOOK' ? 'Webhook: đã thanh toán, đã mở khoá học' : 'Đối soát: đã thanh toán, đã mở khoá học');
    });
  }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  async adminList(filters: { q?: string; status?: string; courseId?: string; needsReview?: boolean }) {
    await this.expireOverdue();
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.status && ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(filters.status)) {
      params.push(filters.status);
      where.push(`o.status = $${params.length}`);
    }
    if (filters.courseId) {
      params.push(filters.courseId);
      where.push(`o.course_id = $${params.length}`);
    }
    if (filters.needsReview) where.push('o.needs_review = true');
    const q = filters.q?.trim().replace(/^VK-?/i, '').slice(0, 100);
    if (q) {
      params.push(`%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
      const p = `$${params.length}`;
      where.push(`(o.order_code::text ILIKE ${p} OR o.user_email ILIKE ${p} OR o.course_title ILIKE ${p} OR u.full_name ILIKE ${p})`);
    }
    const rows = await this.db.queryAll(
      `SELECT o.*, u.full_name AS user_name
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY o.created_at DESC LIMIT 200`,
      params,
    );
    return rows.map((r) => this.toAdminOrder(r));
  }

  async adminGet(orderId: string) {
    const order = await this.db.queryOne(
      `SELECT o.*, u.full_name AS user_name FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
      [orderId],
    );
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    const events = await this.db.queryAll(
      `SELECT e.id, e.kind, e.outcome, e.message, e.created_at, a.full_name AS actor_name
       FROM payment_events e LEFT JOIN users a ON a.id = e.actor_id
       WHERE e.order_id = $1 ORDER BY e.created_at ASC`,
      [orderId],
    );
    return {
      ...this.toAdminOrder(order),
      events: events.map((e) => ({
        id: e.id,
        kind: e.kind,
        outcome: e.outcome,
        message: e.message,
        actorName: e.actor_name ?? null,
        createdAt: e.created_at,
      })),
    };
  }

  /** Money confirmed outside the automatic flow (wrong amount, late transfer…). */
  async adminGrant(admin: AuthUser, orderId: string, note?: string) {
    await this.db.withTransaction(async (tx) => {
      const order = (await tx.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (!order.user_id || !order.course_id) {
        throw new BadRequestException('Học viên hoặc khoá học của đơn này đã bị xoá.');
      }
      if (order.status === 'REFUNDED') throw new BadRequestException('Đơn đã hoàn tiền, không cấp quyền được.');
      await tx.query(
        `UPDATE orders SET status = 'PAID', paid_at = COALESCE(paid_at, now()), needs_review = false, updated_at = now()
         WHERE id = $1`,
        [orderId],
      );
      await this.grantAccess(tx, order, admin.id, `Cấp thủ công cho đơn ${displayCode(order.order_code)}`);
      await this.logEvent(tx, {
        orderId,
        kind: 'ADMIN_GRANT',
        outcome: 'GRANTED',
        message: note?.trim() || 'Admin cấp quyền thủ công',
        actorId: admin.id,
      });
    });
    return this.adminGet(orderId);
  }

  /** Records a refund made at the bank/PayOS and closes access. Moves no money. */
  async adminRefund(admin: AuthUser, orderId: string, note?: string) {
    await this.db.withTransaction(async (tx) => {
      const order = (await tx.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status !== 'PAID') throw new BadRequestException('Chỉ đánh dấu hoàn tiền cho đơn đã thanh toán.');
      await tx.query(
        `UPDATE orders SET status = 'REFUNDED', refunded_at = now(), needs_review = false, updated_at = now() WHERE id = $1`,
        [orderId],
      );
      if (order.user_id && order.course_id) {
        await tx.query(
          `UPDATE course_enrollments SET can_view = false, granted_by_id = $1, note = $2, updated_at = now()
           WHERE course_id = $3 AND student_id = $4`,
          [admin.id, `Thu hồi do hoàn tiền đơn ${displayCode(order.order_code)}`, order.course_id, order.user_id],
        );
      }
      await this.logEvent(tx, {
        orderId,
        kind: 'ADMIN_REFUND',
        outcome: 'REFUNDED',
        message: note?.trim() || 'Admin đánh dấu đã hoàn tiền, thu hồi quyền xem',
        actorId: admin.id,
      });
    });
    return this.adminGet(orderId);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async loadOrderFor(user: AuthUser, orderId: string) {
    const order = await this.db.queryOne('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!order || (order.user_id !== user.id && user.role !== Role.ADMIN)) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }
    return order;
  }

  /** Asks the gateway (throttled), then expires the order if its time is up. */
  private async refreshPending(order: any) {
    const lastChecked = order.last_checked_at ? new Date(order.last_checked_at).getTime() : 0;
    if (Date.now() - lastChecked >= RECONCILE_EVERY_MS) {
      await this.db.query('UPDATE orders SET last_checked_at = now() WHERE id = $1', [order.id]);
      try {
        const paid = await this.gateway.fetchPaid(Number(order.order_code));
        if (paid) await this.applyPaid(paid, 'RECONCILE', { source: 'reconcile', orderCode: paid.orderCode });
      } catch (err) {
        // Reconciliation is a safety net; the webhook is the main path.
        this.logger.warn(`Reconcile ${order.order_code} failed: ${(err as Error).message}`);
      }
    }
    const fresh = await this.db.queryOne('SELECT * FROM orders WHERE id = $1', [order.id]);
    if (fresh.status === 'PENDING' && new Date(fresh.expires_at).getTime() <= Date.now()) {
      await this.expire(fresh);
      return this.db.queryOne('SELECT * FROM orders WHERE id = $1', [order.id]);
    }
    return fresh;
  }

  private async expire(order: any) {
    const res = await this.db.query(
      `UPDATE orders SET status = 'EXPIRED', updated_at = now() WHERE id = $1 AND status = 'PENDING'`,
      [order.id],
    );
    if (res.rowCount) {
      await this.gateway.cancel(Number(order.order_code));
      await this.logEvent(this.db, { orderId: order.id, kind: 'EXPIRED', outcome: 'EXPIRED', message: 'Mã QR hết hạn' });
    }
  }

  private async expireOverdue() {
    const overdue = await this.db.queryAll(
      `SELECT id, order_code FROM orders WHERE status = 'PENDING' AND expires_at <= now() LIMIT 50`,
    );
    for (const o of overdue) await this.expire(o);
  }

  private async grantAccess(tx: PoolClient, order: any, grantedBy: string | null, note: string) {
    if (!order.user_id || !order.course_id) {
      await tx.query('UPDATE orders SET needs_review = true WHERE id = $1', [order.id]);
      return;
    }
    await tx.query(
      `INSERT INTO course_enrollments (id, course_id, student_id, granted_by_id, can_view, note)
       VALUES ($1, $2, $3, $4, true, $5)
       ON CONFLICT (course_id, student_id)
       DO UPDATE SET can_view = true, granted_by_id = EXCLUDED.granted_by_id, note = EXCLUDED.note, updated_at = now()`,
      [generateId('enroll'), order.course_id, order.user_id, grantedBy, note],
    );
  }

  private async logEvent(
    runner: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    e: { orderId: string; kind: string; outcome: string; message?: string; actorId?: string },
  ) {
    await runner.query(
      `INSERT INTO payment_events (id, order_id, gateway, kind, outcome, message, actor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [generateId('pev'), e.orderId, this.gateway.name, e.kind, e.outcome, e.message ?? null, e.actorId ?? null],
    );
  }

  private toLearnerOrder(o: any, opts: { withQr?: boolean } = {}) {
    const pending = o.status === 'PENDING';
    return {
      id: o.id,
      code: displayCode(o.order_code),
      courseId: o.course_id,
      courseTitle: o.course_title,
      amountVnd: o.amount_vnd,
      status: o.status as OrderStatus,
      qrCode: pending && opts.withQr !== false ? o.qr_code : null,
      checkoutUrl: pending ? o.checkout_url : null,
      expiresAt: o.expires_at,
      paidAt: o.paid_at,
      createdAt: o.created_at,
      canSimulate: pending && this.canSimulate,
    };
  }

  private toAdminOrder(o: any) {
    return {
      id: o.id,
      code: displayCode(o.order_code),
      orderCode: Number(o.order_code),
      userId: o.user_id,
      userEmail: o.user_email,
      userName: o.user_name ?? null,
      courseId: o.course_id,
      courseTitle: o.course_title,
      amountVnd: o.amount_vnd,
      status: o.status as OrderStatus,
      needsReview: o.needs_review,
      gateway: o.gateway,
      expiresAt: o.expires_at,
      paidAt: o.paid_at,
      refundedAt: o.refunded_at,
      createdAt: o.created_at,
    };
  }
}
