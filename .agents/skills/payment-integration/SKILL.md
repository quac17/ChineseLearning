---
name: payment-integration
description: >-
  Design and implement paid course purchases in Vân Kính with PayOS (VietQR)
  behind a gateway adapter: orders, checkout link, signed webhook, idempotent
  processing and automatic enrollment. Use when working on buying a course,
  prices, orders, checkout, payment webhooks, refunds or adding VNPay/MoMo.
  Triggers: "thanh toán", "mua khoá học", "PayOS", "VNPay", "MoMo", "webhook",
  "đơn hàng", "giá khoá học", "checkout", "payment".
---

# Payments (PayOS first, adapter for others)

Today access is granted by hand (teacher/admin creates a `course_enrollments`
row). Payments must end in **the same enrollment row**, so access checks stay
in one place (`video-access` skill).

## Data model (add with the `raw-sql-migration` skill)

- `courses.price_vnd INTEGER NOT NULL DEFAULT 0` (0 = free; keep `is_free` in
  sync or derive it).
- `orders`: `id`, `user_id`, `course_id`, `amount_vnd`, `status`
  (`PENDING | PAID | CANCELLED | EXPIRED | REFUNDED`, CHECK constraint),
  `gateway` (`PAYOS`, …), `gateway_order_code` (**unique**, the number sent to
  PayOS), `checkout_url`, `paid_at`, `created_at`, `updated_at`.
- `payment_events`: raw webhook payloads with `gateway`, `event_id`/reference
  (**unique** per gateway), `order_id`, `payload JSONB`, `received_at`. This is
  the idempotency record and the audit log.
- Money is integer VND. Never floats, never trust an amount from the client.

## Module shape (server/src/payments/)

```
payments/
├── payments.module.ts
├── payments.controller.ts     POST /payments/checkout, POST /payments/webhook/payos, GET /payments/orders/:id
├── payments.service.ts        orders, state machine, grants enrollment
└── gateways/
    ├── payment-gateway.ts     interface PaymentGateway { createCheckout(order); verifyWebhook(rawBody, headers); }
    └── payos.gateway.ts       the only file that knows PayOS
```

Adding VNPay/MoMo later = a new file in `gateways/` + a new webhook route.
`PaymentsService` never imports a gateway SDK directly.

## Flow

1. `POST /payments/checkout { courseId }` (JwtAuthGuard): load the price from
   the DB, refuse if the user already has access, reuse a still-valid
   `PENDING` order for the same user+course, else create one, call
   `gateway.createCheckout`, return `checkoutUrl` / QR data.
2. Learner pays in PayOS. The **return URL is only UX**: the result page polls
   `GET /payments/orders/:id`; it never grants access by itself.
3. `POST /payments/webhook/payos` (public route, no JWT):
   1. verify the signature with the checksum key (`verifyWebhook`); reject
      with 400 if invalid;
   2. insert into `payment_events`; on unique-violation return 200 (already
      processed);
   3. in **one transaction**: lock the order (`SELECT … FOR UPDATE`), check
      the amount equals `amount_vnd`, move `PENDING → PAID`, upsert
      `course_enrollments` (`ON CONFLICT (course_id, student_id) DO UPDATE SET
      can_view = true`), with `granted_by_id = NULL` and a note like
      `PAYOS order <code>`;
   4. return 200 quickly. Any other status transition is ignored and logged.
4. Webhooks can arrive twice, late, or out of order: every step above must be
   safe to repeat.

`DatabaseService` has no transaction helper yet; add one
(`withTransaction(async (client) => …)` using `pool.connect()`, `BEGIN`,
`COMMIT`, `ROLLBACK`, `release()`) rather than issuing BEGIN on the shared pool.

## Secrets and config

`PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`,
`PAYMENT_RETURN_URL`, `PAYMENT_CANCEL_URL` in `server/.env.example` with
placeholder values only. The repo is public: never commit real keys, never log
the checksum key or full webhook headers.

## Tests

- Jest: signature valid/invalid, duplicate webhook, wrong amount, unknown
  order, already-paid order, enrollment upsert when a revoked row exists.
- E2E (`e2e-playwright`): checkout as `studentB@vankinh.vn`, then simulate a
  signed webhook (test helper signs with the test checksum key) and assert
  the paid lesson becomes playable. Never call the real PayOS API in CI.
