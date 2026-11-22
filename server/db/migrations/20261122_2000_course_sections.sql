-- Course sections ("Phần"): ordered groups of lessons inside a course.
-- Lessons without a section stay valid; a course with no sections lists its
-- lessons flat, as before.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2000_course_sections.sql

BEGIN;

CREATE TABLE IF NOT EXISTS course_sections (
  id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT course_sections_pkey PRIMARY KEY (id),
  CONSTRAINT course_sections_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS section_id VARCHAR(64);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_section_id_fkey') THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_section_id_fkey FOREIGN KEY (section_id) REFERENCES course_sections(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lessons_section ON public.lessons USING btree (section_id);
CREATE INDEX IF NOT EXISTS idx_course_sections_course ON public.course_sections USING btree (course_id, sort_order);

COMMIT;
