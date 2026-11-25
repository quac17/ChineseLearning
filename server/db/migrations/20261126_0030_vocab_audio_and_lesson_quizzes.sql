-- Vocabulary custom audio override & manual lesson quiz configuration.
-- Safe to run multiple times (idempotent).

-- 1. Custom audio override fields on lesson_vocabulary
ALTER TABLE lesson_vocabulary
  ADD COLUMN IF NOT EXISTS audio_override BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS audio_mime_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS audio_original_name VARCHAR(255);

-- 2. Quiz mode on lessons ('AUTO' | 'MANUAL')
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS quiz_mode VARCHAR(20) NOT NULL DEFAULT 'AUTO';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_quiz_mode_check'
  ) THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_quiz_mode_check CHECK (quiz_mode IN ('AUTO', 'MANUAL'));
  END IF;
END $$;

-- 3. Manual quiz questions table
CREATE TABLE IF NOT EXISTS lesson_quiz_questions (
  id VARCHAR(64) NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  vocabulary_id VARCHAR(64),
  prompt TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  audio_override BOOLEAN NOT NULL DEFAULT false,
  audio_storage_key TEXT,
  audio_mime_type VARCHAR(120),
  audio_original_name VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_quiz_questions_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_quiz_questions_kind_check CHECK (kind IN ('choice', 'listen', 'order', 'fill', 'match')),
  CONSTRAINT lesson_quiz_questions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  CONSTRAINT lesson_quiz_questions_vocabulary_id_fkey FOREIGN KEY (vocabulary_id) REFERENCES lesson_vocabulary(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lesson_quiz_questions_lesson
  ON public.lesson_quiz_questions USING btree (lesson_id, sort_order);
