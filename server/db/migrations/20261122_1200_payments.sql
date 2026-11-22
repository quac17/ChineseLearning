-- Payments (PayOS): course prices, orders, payment events.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_1200_payments.sql

BEGIN;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_vnd INTEGER;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_price_vnd_check') THEN
    ALTER TABLE courses ADD CONSTRAINT courses_price_vnd_check CHECK (price_vnd IS NULL OR price_vnd > 0);
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS order_code_seq START WITH 1000001;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL,
  order_code BIGINT NOT NULL DEFAULT nextval('order_code_seq'),
  user_id VARCHAR(64),
  course_id VARCHAR(64),
  user_email VARCHAR(255) NOT NULL,
  course_title VARCHAR(255) NOT NULL,
  amount_vnd INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  gateway VARCHAR(20) NOT NULL,
  gateway_link_id VARCHAR(100),
  checkout_url TEXT,
  qr_code TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT uq_orders_order_code UNIQUE (order_code),
  CONSTRAINT orders_amount_vnd_check CHECK (amount_vnd > 0),
  CONSTRAINT orders_status_check CHECK (status IN ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'REFUNDED')),
  CONSTRAINT orders_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment_events (
  id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64),
  gateway VARCHAR(20) NOT NULL,
  kind VARCHAR(30) NOT NULL,
  event_key VARCHAR(150),
  outcome VARCHAR(40) NOT NULL,
  message TEXT,
  actor_id VARCHAR(64),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_pkey PRIMARY KEY (id),
  CONSTRAINT payment_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT payment_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_key ON public.payment_events USING btree (gateway, event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON public.payment_events USING btree (order_id, created_at);

COMMIT;
