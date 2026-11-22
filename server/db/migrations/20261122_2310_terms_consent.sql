-- Consent to the Terms of use and Privacy policy on register (#30).
-- New self-registered accounts store when they ticked the consent box.
-- Existing accounts stay NULL: they never saw the box, so no consent is assumed.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2310_terms_consent.sql

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

COMMIT;
