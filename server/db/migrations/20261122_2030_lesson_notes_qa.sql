-- Lesson notes (private per learner, optional video second) and lesson Q&A.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2030_lesson_notes_qa.sql

BEGIN;

-- Private notes of a learner on a lesson, optionally pinned to a video time.
CREATE TABLE IF NOT EXISTS lesson_notes (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  body TEXT NOT NULL,
  video_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_notes_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_notes_body_check CHECK (char_length(body) BETWEEN 1 AND 2000),
  CONSTRAINT lesson_notes_video_seconds_check CHECK (video_seconds IS NULL OR video_seconds >= 0),
  CONSTRAINT lesson_notes_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT lesson_notes_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  CONSTRAINT lesson_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Q&A under a lesson: learners with course access ask, the course's teacher or an admin answers.
CREATE TABLE IF NOT EXISTS lesson_questions (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_questions_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_questions_body_check CHECK (char_length(body) BETWEEN 1 AND 2000),
  CONSTRAINT lesson_questions_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT lesson_questions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  CONSTRAINT lesson_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lesson_answers (
  id VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_answers_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_answers_body_check CHECK (char_length(body) BETWEEN 1 AND 2000),
  CONSTRAINT lesson_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES lesson_questions(id) ON DELETE CASCADE,
  CONSTRAINT lesson_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_lesson ON public.lesson_notes USING btree (user_id, lesson_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson ON public.lesson_questions USING btree (lesson_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_answers_question ON public.lesson_answers USING btree (question_id, created_at);

COMMIT;
