---
name: payment-integration
description: >-
  Design and implement paid course purchases in Chinese Learner with PayOS (VietQR)
  behind a gateway adapter: orders, checkout link, signed webhook, idempotent
  processing and automatic enrollment. Use when working on buying a course,
  prices, orders, checkout, payment webhooks, refunds or adding VNPay/MoMo.
  Triggers: "thanh toán", "mua khoá học", "PayOS", "VNPay", "MoMo", "webhook",
  "đơn hàng", "giá khoá học", "checkout", "payment".
---

# Payments (PayOS first, adapter for others)

Implemented in `server/src/payments/` (PayOS + a fake gateway). Payments end
in **the same `course_enrollments` row** a teacher would create, so access
checks stay in one place (`video-access` skill).

**PayOS has no sandbox** (https://payos.vn/docs/moi-truong-test): every PayOS
call is real money. Local and e2e use `PAYMENT_GATEWAY=fake`, which speaks the
PayOS webhook format and signature with a dev key; the checkout page shows a
dev-only "Giả lập: đã thanh toán" button that goes through the real webhook
code. The fake gateway refuses to start when `NODE_ENV=production`.

## Data model (add with the `raw-sql-migration` skill)

- `courses.price_vnd INTEGER NULL` (`NULL` = paid course not on sale; `is_free`
  stays the free flag). Only admins set it (`PATCH /courses/:id/price`).
- `orders`: `order_code` from `order_code_seq` (starts 1000001, **unique**,
  sent to PayOS; shown as `VK-1000001`; transfer description `VK1000001`
  fits PayOS's 9-character limit), `user_id`/`course_id` (SET NULL) plus
  `user_email`/`course_title` snapshots, `amount_vnd`, `status`
  (`PENDING | PAID | CANCELLED | EXPIRED | REFUNDED`), `gateway`, `qr_code`,
  `checkout_url`, `needs_review`, `expires_at` (15 min), `paid_at`,
  `refunded_at`, `last_checked_at`.
- `payment_events`: webhooks, reconciliations and admin actions, with
  `event_key` **unique per gateway** (the transaction reference). This is the
  idempotency record and the order history shown to admins.
- Money is integer VND. Never floats, never trust an amount from the client.

## Module shape (server/src/payments/)

```
payments/
├── payments.module.ts         picks the gateway from PAYMENT_GATEWAY
├── payments.controller.ts     checkout, orders (mine / :id / simulate-paid), webhook/payos, admin/orders…
├── payments.service.ts        orders, state machine, reconciliation, grants enrollment
└── gateways/
    ├── payment-gateway.ts     interface PaymentGateway { createCheckout, verifyWebhook, fetchPaid, cancel }
    ├── payos-signature.ts     HMAC-SHA256 data string + constant-time verify (+ .spec.ts)
    ├── payos.gateway.ts       the only file that calls PayOS
    └── fake.gateway.ts        local/e2e stand-in, never in production
```

Adding VNPay/MoMo later = a new file in `gateways/` + a new webhook route.
`PaymentsService` never imports a gateway SDK directly.

## Flow

1. `POST /payments/checkout { courseId }` (JwtAuthGuard): load the price from
   the DB, refuse if the user already has access, reuse a still-valid
   `PENDING` order for the same user+course, else create one, call
   `gateway.createCheckout`, return `checkoutUrl` / QR data.
2. Learner pays (QR on our `/checkout/[orderId]` page, or PayOS's page). The
   **return URL is only UX**: the page polls `GET /payments/orders/:id`; it
   never grants access by itself. While pending, that endpoint also asks the
   gateway (at most every 5 s) and applies a payment it reports, so a lost or
   unreachable webhook (e.g. localhost) still ends in access.
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

`PAYMENT_GATEWAY` (`fake` | `payos`), `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`,
`PAYOS_CHECKSUM_KEY`, `APP_URL` (return/cancel URLs are
`${APP_URL}/checkout/<order id>`), `FAKE_PAYMENT_CHECKSUM_KEY` in
`server/.env.example` with placeholder values only. The repo is public: never commit real keys, never log
the checksum key or full webhook headers.

## Tests

- Jest (`server/src/payments/gateways/payos-signature.spec.ts`): data string,
  checkout signature, valid/tampered/missing webhook signatures.
- E2E (`e2e/specs/payments.spec.ts`, fake gateway): bad signature 400, wrong
  amount → needs review and no access, duplicate and late webhooks are no-ops,
  unknown order acknowledged, purchase re-opens a revoked enrollment, admin
  refund closes access, admin-only prices, and the browser flow (buy → QR →
  simulate → learn). Purchases use **fresh students**, never the seed
  accounts. `e2e/fixtures/payments.ts` signs webhooks independently of the
  server code. Never call the real PayOS API in CI.

## Trying real PayOS (real money)

Set `PAYMENT_GATEWAY=payos` and the three keys in `server/.env`, register the
webhook URL (`https://<api>/api/payments/webhook/payos`) in my.payos.vn, and
buy the 2.000 ₫ demo course (`demo-course-travel`, `yarn db:demo`). Locally
there is no public webhook URL; reconciliation on the checkout page picks up
the payment instead.
