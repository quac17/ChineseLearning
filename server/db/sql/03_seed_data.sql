-- ============================================================================
-- 云径 · Vân Kính - Seed Data (Dumped from current DB)
-- Dumped at: 2026-11-19T17:55:51.185Z
-- Lưu ý: Master data (roles, program_modules) được giữ nguyên tại 02_master_data.sql
-- ============================================================================

-- Table: users (4 rows)
INSERT INTO "users" ("id", "email", "password_hash", "full_name", "phone", "bio", "role", "is_active", "created_at", "updated_at") VALUES ('user-admin-01', 'admin@vankinh.vn', '$2a$10$B44QdFVX82j.ZHbeUnmi8.0o102l6k0Ol30CsFDVMB4ltHr8cdF9O', 'Quản trị viên Vân Kính', '0900000001', 'Quản trị hệ thống nền tảng học tiếng Trung Vân Kính.', 'ADMIN', TRUE, '2026-11-19T17:23:56.795Z', '2026-11-19T17:23:56.795Z') ON CONFLICT ("id") DO UPDATE SET "email" = EXCLUDED."email", "password_hash" = EXCLUDED."password_hash", "full_name" = EXCLUDED."full_name", "phone" = EXCLUDED."phone", "bio" = EXCLUDED."bio", "role" = EXCLUDED."role", "is_active" = EXCLUDED."is_active", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "users" ("id", "email", "password_hash", "full_name", "phone", "bio", "role", "is_active", "created_at", "updated_at") VALUES ('user-student-a', 'studenta@vankinh.vn', '$2a$10$.fFtSSHc4VZRJUV4p/ib/eKmTdvdx8e3LWTM26iTnIVlIfPss1dsS', 'Nguyễn Văn A (Học sinh)', '0900000003', 'Học viên lớp HSK 1 – mục tiêu thi đỗ HSK 1 trong 3 tháng.', 'STUDENT', TRUE, '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "email" = EXCLUDED."email", "password_hash" = EXCLUDED."password_hash", "full_name" = EXCLUDED."full_name", "phone" = EXCLUDED."phone", "bio" = EXCLUDED."bio", "role" = EXCLUDED."role", "is_active" = EXCLUDED."is_active", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "users" ("id", "email", "password_hash", "full_name", "phone", "bio", "role", "is_active", "created_at", "updated_at") VALUES ('user-student-b', 'studentb@vankinh.vn', '$2a$10$.fFtSSHc4VZRJUV4p/ib/eKmTdvdx8e3LWTM26iTnIVlIfPss1dsS', 'Trần Thị B (Học sinh)', '0900000004', 'Người mới bắt đầu làm quen tiếng Trung.', 'STUDENT', TRUE, '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "email" = EXCLUDED."email", "password_hash" = EXCLUDED."password_hash", "full_name" = EXCLUDED."full_name", "phone" = EXCLUDED."phone", "bio" = EXCLUDED."bio", "role" = EXCLUDED."role", "is_active" = EXCLUDED."is_active", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "users" ("id", "email", "password_hash", "full_name", "phone", "bio", "role", "is_active", "created_at", "updated_at") VALUES ('user-teacher-01', 'teacher@vankinh.vn', '$2a$10$R81Vn0BlfMpXKbxg7E6KGeoAEUjLmhdXPFQFlxWftGDCWPaMPZNWO', 'Cô Ngân (Giáo viên)', '0900000002', 'Giảng viên tiếng Trung HSK 1–6 & giao tiếp cho người Việt.', 'TEACHER', TRUE, '2026-11-19T17:25:59.869Z', '2026-11-19T17:31:22.796Z') ON CONFLICT ("id") DO UPDATE SET "email" = EXCLUDED."email", "password_hash" = EXCLUDED."password_hash", "full_name" = EXCLUDED."full_name", "phone" = EXCLUDED."phone", "bio" = EXCLUDED."bio", "role" = EXCLUDED."role", "is_active" = EXCLUDED."is_active", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";

-- Table: courses (4 rows)
INSERT INTO "courses" ("id", "title", "description", "module", "sort_order", "is_free", "is_published", "teacher_id", "created_at", "updated_at") VALUES ('course-hsk1', 'HSK 1 – Nền tảng giao tiếp & 150 từ vựng', 'Lộ trình HSK 1 bài bản cho người Việt bắt đầu từ số 0: phát âm chuẩn, ngữ pháp cốt lõi và luyện đề.', 'hsk', 0, FALSE, TRUE, 'user-teacher-01', '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "description" = EXCLUDED."description", "module" = EXCLUDED."module", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "is_published" = EXCLUDED."is_published", "teacher_id" = EXCLUDED."teacher_id", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "courses" ("id", "title", "description", "module", "sort_order", "is_free", "is_published", "teacher_id", "created_at", "updated_at") VALUES ('course-easy1', 'Easy Steps – Tiếng Trung bước đầu', 'Những bước đầu tiên, nhẹ nhàng như lá non đầu xuân. Phù hợp cho bé và người mới.', 'easy', 0, TRUE, TRUE, 'user-teacher-01', '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "description" = EXCLUDED."description", "module" = EXCLUDED."module", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "is_published" = EXCLUDED."is_published", "teacher_id" = EXCLUDED."teacher_id", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "courses" ("id", "title", "description", "module", "sort_order", "is_free", "is_published", "teacher_id", "created_at", "updated_at") VALUES ('course-yct1', 'YCT 1 – Tiếng Trung thiếu nhi', 'Chương trình chuẩn YCT cho thiếu nhi với hình ảnh sinh động và bài tập vui nhộn.', 'yct', 0, FALSE, TRUE, 'user-teacher-01', '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "description" = EXCLUDED."description", "module" = EXCLUDED."module", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "is_published" = EXCLUDED."is_published", "teacher_id" = EXCLUDED."teacher_id", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "courses" ("id", "title", "description", "module", "sort_order", "is_free", "is_published", "teacher_id", "created_at", "updated_at") VALUES ('course-talk1', 'Giao tiếp đời sống & Thương mại cơ bản', 'Hội thoại thực tế: chào hỏi, mua sắm, đặt món, công sở và đàm phán cơ bản.', 'talk', 0, FALSE, TRUE, 'user-teacher-01', '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "description" = EXCLUDED."description", "module" = EXCLUDED."module", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "is_published" = EXCLUDED."is_published", "teacher_id" = EXCLUDED."teacher_id", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";

-- Prices (test values for local/e2e, not real prices). HSK 1 and YCT 1 are on
-- sale; "Giao tiếp" stays NULL to cover a paid course that is not on sale yet.
UPDATE "courses" SET "price_vnd" = 499000 WHERE "id" = 'course-hsk1';
UPDATE "courses" SET "price_vnd" = 399000 WHERE "id" = 'course-yct1';

-- Course info (#28): subtitle, level, "Bạn sẽ học được". No ratings and no
-- learner counts in seed data (docs/design/DECISIONS.md). No covers: cards
-- fall back to the program colour.
UPDATE "courses" SET "subtitle" = 'Phát âm chuẩn, ngữ pháp cốt lõi và luyện đề cho người bắt đầu từ số 0.', "level" = 'BEGINNER',
  "outcomes" = ARRAY['Đọc đúng pinyin và bốn thanh điệu', 'Chào hỏi, giới thiệu bản thân, hỏi tuổi', 'Dùng 150 từ vựng HSK 1 trong câu', 'Làm đề mẫu HSK 1 có giải thích']
  WHERE "id" = 'course-hsk1';
UPDATE "courses" SET "level" = 'BEGINNER', "outcomes" = ARRAY['Gọi tên các thành viên trong gia đình', 'Chào hỏi thân thiện bằng tiếng Trung'] WHERE "id" = 'course-easy1';
UPDATE "courses" SET "level" = 'BEGINNER' WHERE "id" = 'course-yct1';

-- Table: lessons (5 rows)
INSERT INTO "lessons" ("id", "course_id", "title", "description", "duration", "sort_order", "is_free", "source_type", "youtube_id", "youtube_url", "storage_key", "original_file_name", "mime_type", "file_size", "created_at", "updated_at") VALUES ('lesson-easy1-b1', 'course-easy1', 'Easy Steps – Bài 1: Gia đình & Chào hỏi', 'Từ vựng gia đình (爸爸, 妈妈) và hội thoại chào hỏi thân thiện.', '8 phút', 1, TRUE, 'YOUTUBE', 'jNQXAC9IVRw', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', NULL, NULL, NULL, NULL, '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "course_id" = EXCLUDED."course_id", "title" = EXCLUDED."title", "description" = EXCLUDED."description", "duration" = EXCLUDED."duration", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "source_type" = EXCLUDED."source_type", "youtube_id" = EXCLUDED."youtube_id", "youtube_url" = EXCLUDED."youtube_url", "storage_key" = EXCLUDED."storage_key", "original_file_name" = EXCLUDED."original_file_name", "mime_type" = EXCLUDED."mime_type", "file_size" = EXCLUDED."file_size", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "lessons" ("id", "course_id", "title", "description", "duration", "sort_order", "is_free", "source_type", "youtube_id", "youtube_url", "storage_key", "original_file_name", "mime_type", "file_size", "created_at", "updated_at") VALUES ('lesson-yct1-b1', 'course-yct1', 'YCT 1 – Bài 1: Thanh điệu vui nhộn', 'Học 4 thanh điệu tiếng Trung qua hình ảnh trực quan cho thiếu nhi.', '10 phút', 1, TRUE, 'YOUTUBE', 'jNQXAC9IVRw', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', NULL, NULL, NULL, NULL, '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "course_id" = EXCLUDED."course_id", "title" = EXCLUDED."title", "description" = EXCLUDED."description", "duration" = EXCLUDED."duration", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "source_type" = EXCLUDED."source_type", "youtube_id" = EXCLUDED."youtube_id", "youtube_url" = EXCLUDED."youtube_url", "storage_key" = EXCLUDED."storage_key", "original_file_name" = EXCLUDED."original_file_name", "mime_type" = EXCLUDED."mime_type", "file_size" = EXCLUDED."file_size", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "lessons" ("id", "course_id", "title", "description", "duration", "sort_order", "is_free", "source_type", "youtube_id", "youtube_url", "storage_key", "original_file_name", "mime_type", "file_size", "created_at", "updated_at") VALUES ('lesson-talk1-b1', 'course-talk1', 'Giao tiếp – Bài 1: Gọi đồ uống & Quán trà', 'Thực hành mẫu câu gọi trà, cà phê và hỏi giá trong quán nước.', '14 phút', 1, FALSE, 'YOUTUBE', 'ysz5S6PUM-U', 'https://www.youtube.com/watch?v=ysz5S6PUM-U', NULL, NULL, NULL, NULL, '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "course_id" = EXCLUDED."course_id", "title" = EXCLUDED."title", "description" = EXCLUDED."description", "duration" = EXCLUDED."duration", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "source_type" = EXCLUDED."source_type", "youtube_id" = EXCLUDED."youtube_id", "youtube_url" = EXCLUDED."youtube_url", "storage_key" = EXCLUDED."storage_key", "original_file_name" = EXCLUDED."original_file_name", "mime_type" = EXCLUDED."mime_type", "file_size" = EXCLUDED."file_size", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "lessons" ("id", "course_id", "title", "description", "duration", "sort_order", "is_free", "source_type", "youtube_id", "youtube_url", "storage_key", "original_file_name", "mime_type", "file_size", "created_at", "updated_at") VALUES ('lesson-hsk1-b1', 'course-hsk1', 'HSK 1 – Bài 1: Xin chào (你好)', 'Làm quen thanh mẫu, vận mẫu, thanh điệu và mẫu câu chào hỏi cơ bản.', '12 phút', 0, TRUE, 'YOUTUBE', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', NULL, NULL, NULL, NULL, '2026-11-19T17:25:59.869Z', '2026-11-19T17:27:51.668Z') ON CONFLICT ("id") DO UPDATE SET "course_id" = EXCLUDED."course_id", "title" = EXCLUDED."title", "description" = EXCLUDED."description", "duration" = EXCLUDED."duration", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "source_type" = EXCLUDED."source_type", "youtube_id" = EXCLUDED."youtube_id", "youtube_url" = EXCLUDED."youtube_url", "storage_key" = EXCLUDED."storage_key", "original_file_name" = EXCLUDED."original_file_name", "mime_type" = EXCLUDED."mime_type", "file_size" = EXCLUDED."file_size", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
INSERT INTO "lessons" ("id", "course_id", "title", "description", "duration", "sort_order", "is_free", "source_type", "youtube_id", "youtube_url", "storage_key", "original_file_name", "mime_type", "file_size", "created_at", "updated_at") VALUES ('lesson-hsk1-b2', 'course-hsk1', 'HSK 1 – Bài 2: Giới thiệu bản thân & Quốc tịch', 'Học cách hỏi tên, giới thiệu nghề nghiệp và quốc tịch (Việt Nam / Trung Quốc).', '15 phút', 1, FALSE, 'YOUTUBE', 'ysz5S6PUM-U', 'https://www.youtube.com/watch?v=ysz5S6PUM-U', NULL, NULL, NULL, NULL, '2026-11-19T17:25:59.869Z', '2026-11-19T17:27:51.676Z') ON CONFLICT ("id") DO UPDATE SET "course_id" = EXCLUDED."course_id", "title" = EXCLUDED."title", "description" = EXCLUDED."description", "duration" = EXCLUDED."duration", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "source_type" = EXCLUDED."source_type", "youtube_id" = EXCLUDED."youtube_id", "youtube_url" = EXCLUDED."youtube_url", "storage_key" = EXCLUDED."storage_key", "original_file_name" = EXCLUDED."original_file_name", "mime_type" = EXCLUDED."mime_type", "file_size" = EXCLUDED."file_size", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";

-- Lesson length in minutes (the free-text "duration" stays as typed).
UPDATE "lessons" SET "duration_minutes" = 8 WHERE "id" = 'lesson-easy1-b1';
UPDATE "lessons" SET "duration_minutes" = 10 WHERE "id" = 'lesson-yct1-b1';
UPDATE "lessons" SET "duration_minutes" = 14 WHERE "id" = 'lesson-talk1-b1';
UPDATE "lessons" SET "duration_minutes" = 12 WHERE "id" = 'lesson-hsk1-b1';
UPDATE "lessons" SET "duration_minutes" = 15 WHERE "id" = 'lesson-hsk1-b2';

-- Table: course_sections (2 rows). HSK 1 is split into sections ("Phần"); the
-- other seed courses keep a flat lesson list. b1 stays free and b2 paid.
INSERT INTO "course_sections" ("id", "course_id", "title", "sort_order", "created_at", "updated_at") VALUES
  ('section-hsk1-01', 'course-hsk1', 'Phát âm và chào hỏi', 0, '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z'),
  ('section-hsk1-02', 'course-hsk1', 'Giới thiệu bản thân', 1, '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z')
ON CONFLICT ("id") DO UPDATE SET "course_id" = EXCLUDED."course_id", "title" = EXCLUDED."title", "sort_order" = EXCLUDED."sort_order", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
UPDATE "lessons" SET "section_id" = 'section-hsk1-01' WHERE "id" = 'lesson-hsk1-b1';
UPDATE "lessons" SET "section_id" = 'section-hsk1-02' WHERE "id" = 'lesson-hsk1-b2';

-- Lesson vocabulary (real HSK/YCT words; e2e relies on lesson-hsk1-b1 being free and b2 paid)
INSERT INTO "lesson_vocabulary" ("id", "lesson_id", "hanzi", "pinyin", "meaning_vi", "example_zh", "example_vi", "sort_order") VALUES
  ('vocab-hsk1-b1-01', 'lesson-hsk1-b1', '你', 'nǐ', 'bạn, anh, chị (ngôi thứ hai)', NULL, NULL, 0),
  ('vocab-hsk1-b1-02', 'lesson-hsk1-b1', '好', 'hǎo', 'tốt, khoẻ', NULL, NULL, 1),
  ('vocab-hsk1-b1-03', 'lesson-hsk1-b1', '你好', 'nǐ hǎo', 'xin chào', '你好，我是老师。', 'Xin chào, tôi là giáo viên.', 2),
  ('vocab-hsk1-b1-04', 'lesson-hsk1-b1', '您', 'nín', 'ông, bà, ngài (lịch sự)', '您好！', 'Xin chào ông/bà!', 3),
  ('vocab-hsk1-b1-05', 'lesson-hsk1-b1', '谢谢', 'xièxie', 'cảm ơn', '谢谢你！', 'Cảm ơn bạn!', 4),
  ('vocab-hsk1-b1-06', 'lesson-hsk1-b1', '不客气', 'bú kèqi', 'không có gì (đáp lời cảm ơn)', NULL, NULL, 5),
  ('vocab-hsk1-b1-07', 'lesson-hsk1-b1', '再见', 'zàijiàn', 'tạm biệt', '老师，再见！', 'Tạm biệt thầy/cô!', 6),
  ('vocab-hsk1-b1-08', 'lesson-hsk1-b1', '对不起', 'duìbuqǐ', 'xin lỗi', NULL, NULL, 7),
  ('vocab-hsk1-b1-09', 'lesson-hsk1-b1', '没关系', 'méi guānxi', 'không sao', NULL, NULL, 8),
  ('vocab-hsk1-b2-01', 'lesson-hsk1-b2', '我', 'wǒ', 'tôi', NULL, NULL, 0),
  ('vocab-hsk1-b2-02', 'lesson-hsk1-b2', '是', 'shì', 'là', '我是越南人。', 'Tôi là người Việt Nam.', 1),
  ('vocab-hsk1-b2-03', 'lesson-hsk1-b2', '叫', 'jiào', 'gọi, tên là', '我叫兰。', 'Tôi tên là Lan.', 2),
  ('vocab-hsk1-b2-04', 'lesson-hsk1-b2', '什么', 'shénme', 'gì, cái gì', '你叫什么名字？', 'Bạn tên là gì?', 3),
  ('vocab-hsk1-b2-05', 'lesson-hsk1-b2', '名字', 'míngzi', 'tên', NULL, NULL, 4),
  ('vocab-hsk1-b2-06', 'lesson-hsk1-b2', '人', 'rén', 'người', NULL, NULL, 5),
  ('vocab-hsk1-b2-07', 'lesson-hsk1-b2', '越南', 'Yuènán', 'Việt Nam', NULL, NULL, 6),
  ('vocab-hsk1-b2-08', 'lesson-hsk1-b2', '中国', 'Zhōngguó', 'Trung Quốc', '他是中国人。', 'Anh ấy là người Trung Quốc.', 7),
  ('vocab-hsk1-b2-09', 'lesson-hsk1-b2', '老师', 'lǎoshī', 'giáo viên', NULL, NULL, 8),
  ('vocab-hsk1-b2-10', 'lesson-hsk1-b2', '学生', 'xuésheng', 'học sinh', NULL, NULL, 9),
  ('vocab-easy1-b1-01', 'lesson-easy1-b1', '爸爸', 'bàba', 'bố', NULL, NULL, 0),
  ('vocab-easy1-b1-02', 'lesson-easy1-b1', '妈妈', 'māma', 'mẹ', '妈妈，你好！', 'Con chào mẹ!', 1),
  ('vocab-easy1-b1-03', 'lesson-easy1-b1', '哥哥', 'gēge', 'anh trai', NULL, NULL, 2),
  ('vocab-easy1-b1-04', 'lesson-easy1-b1', '姐姐', 'jiějie', 'chị gái', NULL, NULL, 3),
  ('vocab-easy1-b1-05', 'lesson-easy1-b1', '弟弟', 'dìdi', 'em trai', NULL, NULL, 4),
  ('vocab-easy1-b1-06', 'lesson-easy1-b1', '妹妹', 'mèimei', 'em gái', NULL, NULL, 5),
  ('vocab-easy1-b1-07', 'lesson-easy1-b1', '家', 'jiā', 'nhà, gia đình', '我爱我家。', 'Tôi yêu gia đình tôi.', 6),
  ('vocab-yct1-b1-01', 'lesson-yct1-b1', '妈', 'mā', 'mẹ (thanh 1)', NULL, NULL, 0),
  ('vocab-yct1-b1-02', 'lesson-yct1-b1', '麻', 'má', 'cây gai (thanh 2)', NULL, NULL, 1),
  ('vocab-yct1-b1-03', 'lesson-yct1-b1', '马', 'mǎ', 'con ngựa (thanh 3)', NULL, NULL, 2),
  ('vocab-yct1-b1-04', 'lesson-yct1-b1', '骂', 'mà', 'mắng (thanh 4)', NULL, NULL, 3),
  ('vocab-yct1-b1-05', 'lesson-yct1-b1', '一', 'yī', 'một', NULL, NULL, 4),
  ('vocab-yct1-b1-06', 'lesson-yct1-b1', '二', 'èr', 'hai', NULL, NULL, 5),
  ('vocab-yct1-b1-07', 'lesson-yct1-b1', '三', 'sān', 'ba', NULL, NULL, 6),
  ('vocab-talk1-b1-01', 'lesson-talk1-b1', '茶', 'chá', 'trà', NULL, NULL, 0),
  ('vocab-talk1-b1-02', 'lesson-talk1-b1', '咖啡', 'kāfēi', 'cà phê', NULL, NULL, 1),
  ('vocab-talk1-b1-03', 'lesson-talk1-b1', '水', 'shuǐ', 'nước', NULL, NULL, 2),
  ('vocab-talk1-b1-04', 'lesson-talk1-b1', '杯', 'bēi', 'cốc, ly (lượng từ)', NULL, NULL, 3),
  ('vocab-talk1-b1-05', 'lesson-talk1-b1', '要', 'yào', 'muốn, cần', '我要一杯茶。', 'Tôi muốn một cốc trà.', 4),
  ('vocab-talk1-b1-06', 'lesson-talk1-b1', '多少钱', 'duōshao qián', 'bao nhiêu tiền', '这杯咖啡多少钱？', 'Cốc cà phê này bao nhiêu tiền?', 5),
  ('vocab-talk1-b1-07', 'lesson-talk1-b1', '服务员', 'fúwùyuán', 'nhân viên phục vụ', NULL, NULL, 6)
ON CONFLICT ("id") DO UPDATE SET "lesson_id" = EXCLUDED."lesson_id", "hanzi" = EXCLUDED."hanzi", "pinyin" = EXCLUDED."pinyin", "meaning_vi" = EXCLUDED."meaning_vi", "example_zh" = EXCLUDED."example_zh", "example_vi" = EXCLUDED."example_vi", "sort_order" = EXCLUDED."sort_order";

-- Table: course_documents (1 rows)
INSERT INTO "course_documents" ("id", "course_id", "title", "description", "original_file_name", "storage_key", "file_type", "mime_type", "file_size", "sort_order", "is_free", "created_at", "updated_at") VALUES ('doc-hsk1-b1', 'course-hsk1', 'Giáo trình tóm tắt HSK 1 – Bài 1 & 2', 'Tài liệu Word tổng hợp từ vựng và mẫu câu cơ bản cho học viên HSK 1.', 'HSK1-Bai1-Bai2-TuVung.doc', 'documents/sample-hsk1-bai1.doc', 'doc', 'application/msword', 411, 0, TRUE, '2026-11-19T17:25:59.869Z', '2026-11-19T17:25:59.869Z') ON CONFLICT ("id") DO UPDATE SET "course_id" = EXCLUDED."course_id", "title" = EXCLUDED."title", "description" = EXCLUDED."description", "original_file_name" = EXCLUDED."original_file_name", "storage_key" = EXCLUDED."storage_key", "file_type" = EXCLUDED."file_type", "mime_type" = EXCLUDED."mime_type", "file_size" = EXCLUDED."file_size", "sort_order" = EXCLUDED."sort_order", "is_free" = EXCLUDED."is_free", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";

-- Table: course_enrollments (1 rows)
INSERT INTO "course_enrollments" ("id", "course_id", "student_id", "granted_by_id", "can_view", "note", "created_at", "updated_at") VALUES ('enroll-hsk1-student-a', 'course-hsk1', 'user-student-a', 'user-teacher-01', TRUE, 'Cấp quyền mặc định cho Học sinh A để kiểm thử phân quyền khóa học HSK 1', '2026-11-19T17:25:59.869Z', '2026-11-19T17:39:28.428Z') ON CONFLICT ("id") DO UPDATE SET "course_id" = EXCLUDED."course_id", "student_id" = EXCLUDED."student_id", "granted_by_id" = EXCLUDED."granted_by_id", "can_view" = EXCLUDED."can_view", "note" = EXCLUDED."note", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";
