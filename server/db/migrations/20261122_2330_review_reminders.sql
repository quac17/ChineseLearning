-- Daily review reminder by email (#38). One row per learner who has touched
-- the "Nhắc ôn tập mỗi ngày" switch; no row means off (opt-in).
-- last_sent_on is the Vietnam calendar day of the last reminder: the job
-- claims a day by moving it forward, so a learner gets at most one mail a day
-- even if the job runs twice.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2330_review_reminders.sql

BEGIN;

CREATE TABLE IF NOT EXISTS review_reminders (
  user_id VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_sent_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_reminders_pkey PRIMARY KEY (user_id),
  CONSTRAINT review_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

COMMIT;
