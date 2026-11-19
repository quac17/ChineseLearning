-- ============================================================================
-- 云径 · Vân Kính - PostgreSQL Schema (DDL)
-- Dumped from current DB at: 2026-11-19T17:55:51.185Z
-- ============================================================================

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_module_fkey FOREIGN KEY (module) REFERENCES program_modules(code),
  CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
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
  original_file_name VARCHAR(255),
  mime_type VARCHAR(120),
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lessons_pkey PRIMARY KEY (id),
  CONSTRAINT lessons_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['UPLOAD'::character varying, 'YOUTUBE'::character varying])::text[]))),
  CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_course ON public.course_documents USING btree (course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.course_enrollments USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.course_enrollments USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_courses_module ON public.courses USING btree (module, sort_order);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON public.courses USING btree (teacher_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON public.lessons USING btree (course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);
