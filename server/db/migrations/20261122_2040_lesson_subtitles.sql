-- Pinyin subtitles (WebVTT) for uploaded-video lessons: storage key of the .vtt file.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2040_lesson_subtitles.sql

BEGIN;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS subtitle_key TEXT;

COMMIT;
