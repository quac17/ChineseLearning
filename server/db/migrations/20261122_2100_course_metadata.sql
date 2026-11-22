-- Course metadata (#28): short subtitle, level, "Bạn sẽ học được" outcomes,
-- uploaded cover image, and lesson length in minutes (the free-text
-- `duration` stays). Existing "12 phút" texts are read into minutes.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2100_course_metadata.sql

BEGIN;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS subtitle VARCHAR(120);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS level VARCHAR(20);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS outcomes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_key TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_level_check') THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_level_check CHECK (level IS NULL OR level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_duration_minutes_check') THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_duration_minutes_check CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 600);
  END IF;
END $$;

-- Backfill only the unambiguous "N phút" texts; teachers fill in the rest.
UPDATE lessons
SET duration_minutes = substring(duration FROM '^\s*(\d{1,3})\s*phút\s*$')::int
WHERE duration_minutes IS NULL
  AND duration ~* '^\s*\d{1,3}\s*phút\s*$'
  AND substring(duration FROM '^\s*(\d{1,3})\s*phút\s*$')::int BETWEEN 1 AND 600;

COMMIT;
