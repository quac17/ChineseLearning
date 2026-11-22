-- Forgot password by email (#31). One row per reset link sent. Only the
-- SHA-256 hash of the token is stored, so a leaked database cannot be used to
-- reset passwords. A link expires 30 minutes after it is sent and works once;
-- a successful reset marks every other open link of that user as used.
-- requested_ip feeds the per-IP rate limit (rows of the last hour).
-- users.password_changed_at: login tokens issued before it are refused, so a
-- reset or a password change logs out every other session.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2300_password_resets.sql

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS password_resets (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  requested_ip VARCHAR(64),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT password_resets_pkey PRIMARY KEY (id),
  CONSTRAINT uq_password_resets_token_hash UNIQUE (token_hash),
  CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON public.password_resets USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_ip ON public.password_resets USING btree (requested_ip, created_at);

COMMIT;
