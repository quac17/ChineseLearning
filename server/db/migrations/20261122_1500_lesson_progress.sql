-- Learning progress per learner and lesson.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_1500_lesson_progress.sql

BEGIN;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_progress_pkey PRIMARY KEY (id),
  CONSTRAINT uq_lesson_progress_user_lesson UNIQUE (user_id, lesson_id),
  CONSTRAINT lesson_progress_position_seconds_check CHECK (position_seconds >= 0),
  CONSTRAINT lesson_progress_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  CONSTRAINT lesson_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course ON public.lesson_progress USING btree (user_id, course_id, updated_at);

COMMIT;
