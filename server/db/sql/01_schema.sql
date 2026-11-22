-- ============================================================================
-- 云径 · Vân Kính - PostgreSQL Schema (DDL)
-- Dumped from current DB at: 2026-11-19T17:55:51.185Z
-- ============================================================================

-- Accent-insensitive course search ("giao tiep" finds "Giao tiếp", đ → d).
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS roles (
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  CONSTRAINT roles_pkey PRIMARY KEY (code)
);

CREATE TABLE IF NOT EXISTS program_modules (
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  han VARCHAR(20) NOT NULL,
  card_desc VARCHAR(255),
  description TEXT,
  color_1 VARCHAR(20) NOT NULL,
  color_2 VARCHAR(20) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT program_modules_pkey PRIMARY KEY (code)
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  bio TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'STUDENT'::character varying,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- When the user ticked "Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật"
  -- on the register form. NULL for accounts created before #30 or by an admin.
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES roles(code)
);

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  module VARCHAR(20) NOT NULL DEFAULT 'hsk'::character varying,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_free BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  teacher_id VARCHAR(64) NOT NULL,
  price_vnd INTEGER,
  subtitle VARCHAR(120),
  level VARCHAR(20),
  outcomes TEXT[] NOT NULL DEFAULT '{}',
  cover_key TEXT,
  rating_value NUMERIC(2,1),
  rating_source VARCHAR(200),
  offline_learner_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_price_vnd_check CHECK (price_vnd IS NULL OR price_vnd > 0),
  CONSTRAINT courses_level_check CHECK (level IS NULL OR level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  -- A rating exists only together with its real source (docs/design/DECISIONS.md).
  CONSTRAINT courses_rating_value_check CHECK (rating_value IS NULL OR rating_value BETWEEN 1 AND 5),
  CONSTRAINT courses_rating_source_check CHECK ((rating_value IS NULL) = (rating_source IS NULL) AND (rating_source IS NULL OR char_length(btrim(rating_source)) >= 10)),
  CONSTRAINT courses_offline_learner_count_check CHECK (offline_learner_count IS NULL OR offline_learner_count > 0),
  CONSTRAINT courses_module_fkey FOREIGN KEY (module) REFERENCES program_modules(code),
  CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- "Phần" of a course: an ordered group of lessons. Courses without sections
-- list their lessons flat, as before.
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

CREATE TABLE IF NOT EXISTS lessons (
  id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_free BOOLEAN NOT NULL DEFAULT false,
  source_type VARCHAR(20) NOT NULL,
  youtube_id VARCHAR(32),
  youtube_url TEXT,
  storage_key TEXT,
  subtitle_key TEXT,
  original_file_name VARCHAR(255),
  mime_type VARCHAR(120),
  file_size INTEGER,
  section_id VARCHAR(64),
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lessons_pkey PRIMARY KEY (id),
  CONSTRAINT lessons_duration_minutes_check CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 600),
  CONSTRAINT lessons_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['UPLOAD'::character varying, 'YOUTUBE'::character varying])::text[]))),
  CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT lessons_section_id_fkey FOREIGN KEY (section_id) REFERENCES course_sections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS course_documents (
  id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  original_file_name VARCHAR(255) NOT NULL,
  storage_key TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT course_documents_pkey PRIMARY KEY (id),
  CONSTRAINT course_documents_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  granted_by_id VARCHAR(64),
  can_view BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT course_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT uq_course_student UNIQUE (course_id, student_id),
  CONSTRAINT course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT course_enrollments_granted_by_id_fkey FOREIGN KEY (granted_by_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT course_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Payments (PayOS). order_code is the integer sent to the gateway; the
-- transfer description is "VK" + order_code, which must fit in 9 characters.
CREATE SEQUENCE IF NOT EXISTS order_code_seq START WITH 1000001;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL,
  order_code BIGINT NOT NULL DEFAULT nextval('order_code_seq'),
  user_id VARCHAR(64),
  course_id VARCHAR(64),
  user_email VARCHAR(255) NOT NULL,
  course_title VARCHAR(255) NOT NULL,
  amount_vnd INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  gateway VARCHAR(20) NOT NULL,
  gateway_link_id VARCHAR(100),
  checkout_url TEXT,
  qr_code TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT uq_orders_order_code UNIQUE (order_code),
  CONSTRAINT orders_amount_vnd_check CHECK (amount_vnd > 0),
  CONSTRAINT orders_status_check CHECK (status IN ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'REFUNDED')),
  CONSTRAINT orders_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Webhooks, reconciliations and admin actions: the idempotency record and the
-- order history. event_key is the gateway's own reference when there is one.
CREATE TABLE IF NOT EXISTS payment_events (
  id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64),
  gateway VARCHAR(20) NOT NULL,
  kind VARCHAR(30) NOT NULL,
  event_key VARCHAR(150),
  outcome VARCHAR(40) NOT NULL,
  message TEXT,
  actor_id VARCHAR(64),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_pkey PRIMARY KEY (id),
  CONSTRAINT payment_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT payment_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Words of a lesson (Hanzi, pinyin with tone marks, Vietnamese meaning). They
-- drive the lesson's vocabulary tab, flashcards, quizzes and writing practice.
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

-- What each learner has watched: last position (uploaded videos) and when a
-- lesson was completed (manual tick, or 90% of an uploaded video).
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

-- Leitner boxes per learner and word (flashcards and quizzes). Box 1–5 waits
-- 1, 2, 4, 8, 16 days; a forgotten or wrong word goes back to box 1, due now.
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

-- Real reviews from learners with access to a paid course (#41, docs/design/DECISIONS.md).
-- One per learner and course; hidden ones are left out of the public list and the average.
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_course ON public.course_documents USING btree (course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.course_enrollments USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.course_enrollments USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_courses_module ON public.courses USING btree (module, sort_order);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON public.courses USING btree (teacher_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON public.lessons USING btree (course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_section ON public.lessons USING btree (section_id);
CREATE INDEX IF NOT EXISTS idx_course_sections_course ON public.course_sections USING btree (course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_key ON public.payment_events USING btree (gateway, event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON public.payment_events USING btree (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course ON public.lesson_progress USING btree (user_id, course_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_lesson_vocabulary_lesson ON public.lesson_vocabulary USING btree (lesson_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vocab_reviews_user_due ON public.vocab_reviews USING btree (user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_lesson ON public.lesson_notes USING btree (user_id, lesson_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson ON public.lesson_questions USING btree (lesson_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_answers_question ON public.lesson_answers USING btree (question_id, created_at);
CREATE INDEX IF NOT EXISTS idx_course_reviews_course ON public.course_reviews USING btree (course_id, is_hidden, created_at);
