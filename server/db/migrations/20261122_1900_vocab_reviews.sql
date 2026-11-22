-- Spaced-repetition state per learner and word.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_1900_vocab_reviews.sql

BEGIN;

CREATE TABLE IF NOT EXISTS vocab_reviews (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  vocabulary_id VARCHAR(64) NOT NULL,
  box SMALLINT NOT NULL DEFAULT 1,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vocab_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT uq_vocab_reviews_user_word UNIQUE (user_id, vocabulary_id),
  CONSTRAINT vocab_reviews_box_check CHECK (box BETWEEN 1 AND 5),
  CONSTRAINT vocab_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT vocab_reviews_vocabulary_id_fkey FOREIGN KEY (vocabulary_id) REFERENCES lesson_vocabulary(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vocab_reviews_user_due ON public.vocab_reviews USING btree (user_id, due_at);

COMMIT;
