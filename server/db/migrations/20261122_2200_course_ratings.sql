-- Sourced course ratings and offline learner counts (#29, docs/design/DECISIONS.md).
-- A rating can only exist together with a real source text; the database
-- refuses one without the other. Offline learners are stored apart from the
-- online learner count, which is computed from open enrollments.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2200_course_ratings.sql

BEGIN;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS rating_value NUMERIC(2,1);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS rating_source VARCHAR(200);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS offline_learner_count INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_rating_value_check') THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_rating_value_check CHECK (rating_value IS NULL OR rating_value BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_rating_source_check') THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_rating_source_check CHECK ((rating_value IS NULL) = (rating_source IS NULL) AND (rating_source IS NULL OR char_length(btrim(rating_source)) >= 10));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_offline_learner_count_check') THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_offline_learner_count_check CHECK (offline_learner_count IS NULL OR offline_learner_count > 0);
  END IF;
END $$;

COMMIT;
