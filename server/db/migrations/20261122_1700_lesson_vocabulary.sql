-- Vocabulary per lesson.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_1700_lesson_vocabulary.sql

BEGIN;

CREATE TABLE IF NOT EXISTS lesson_vocabulary (
  id VARCHAR(64) NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  hanzi VARCHAR(50) NOT NULL,
  pinyin VARCHAR(120) NOT NULL,
  meaning_vi VARCHAR(255) NOT NULL,
  example_zh TEXT,
  example_vi TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_vocabulary_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_vocabulary_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lesson_vocabulary_lesson ON public.lesson_vocabulary USING btree (lesson_id, sort_order);

COMMIT;
