-- Real course reviews from learners who bought the course (#41, docs/design/DECISIONS.md).
-- One review per learner and course. Hidden reviews stay stored (the author still
-- sees theirs) but are left out of the public list and the average.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2320_course_reviews.sql

BEGIN;

CREATE TABLE IF NOT EXISTS course_reviews (
  id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  stars SMALLINT NOT NULL,
  comment TEXT,
  reply TEXT,
  replied_by_id VARCHAR(64),
  replied_at TIMESTAMPTZ,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  hidden_by_id VARCHAR(64),
  hidden_reason VARCHAR(300),
  hidden_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT course_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT uq_course_reviews_course_student UNIQUE (course_id, student_id),
  CONSTRAINT course_reviews_stars_check CHECK (stars BETWEEN 1 AND 5),
  CONSTRAINT course_reviews_comment_check CHECK (comment IS NULL OR char_length(comment) BETWEEN 1 AND 1000),
  CONSTRAINT course_reviews_reply_check CHECK ((reply IS NULL) = (replied_at IS NULL) AND (reply IS NULL OR char_length(reply) BETWEEN 1 AND 1000)),
  CONSTRAINT course_reviews_hidden_check CHECK (NOT is_hidden OR (hidden_reason IS NOT NULL AND hidden_at IS NOT NULL)),
  CONSTRAINT course_reviews_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT course_reviews_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT course_reviews_replied_by_id_fkey FOREIGN KEY (replied_by_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT course_reviews_hidden_by_id_fkey FOREIGN KEY (hidden_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_course_reviews_course ON public.course_reviews USING btree (course_id, is_hidden, created_at);

COMMIT;
