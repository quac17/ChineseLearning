-- ============================================================================
-- Chinese Learner - Demo data (local UI testing only)
--
-- Loaded by `yarn db:demo` ON TOP of 03_seed_data.sql. Never loaded by e2e:
-- 03_seed_data.sql is the e2e contract and stays small.
--
-- Everything here is invented sample content: names, courses, lessons and
-- notes are made up, emails use the demo.chineselearner.vn sub-domain, and the
-- password for every demo account is Demo@123. No ratings or student counts:
-- those must come from real data (docs/design/DECISIONS.md). Prices below are
-- test values so checkout can be tried locally; demo-course-travel costs
-- 2.000 ₫ for a real-money PayOS test.
--
-- Re-runnable: it deletes every demo-* row first, then inserts again.
-- Lesson videos and documents are files written by `yarn db:demo`
-- (server/db/scripts/db-cli.ts + scripts/demo/make-videos.mjs).
-- ============================================================================

DELETE FROM course_enrollments WHERE id LIKE 'demo-%';
DELETE FROM course_documents WHERE id LIKE 'demo-%';
DELETE FROM lessons WHERE id LIKE 'demo-%';
DELETE FROM courses WHERE id LIKE 'demo-%';
DELETE FROM users WHERE id LIKE 'demo-%';

-- ---------------------------------------------------------------------------
-- Users (password: Demo@123)
-- ---------------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, full_name, phone, bio, role, is_active, created_at, updated_at) VALUES
  ('demo-teacher-minh', 'gv.minh@demo.chineselearner.vn', '$2a$10$r7rBDrXyy2Zcta7wFSIrbuIfA5bG4FDcyFNTTc3AzPpgcO./260e6', 'Thầy Lê Minh', '0911000001',
   'Dạy HSK 2–4 và tiếng Trung du lịch. Hồ sơ mẫu cho dữ liệu demo.', 'TEACHER', TRUE, now() - interval '200 days', now()),
  ('demo-teacher-ha', 'gv.ha@demo.chineselearner.vn', '$2a$10$r7rBDrXyy2Zcta7wFSIrbuIfA5bG4FDcyFNTTc3AzPpgcO./260e6', 'Cô Phạm Thu Hà', '0911000002',
   'Chuyên phát âm, ngữ pháp sơ cấp và tiếng Trung công sở. Hồ sơ mẫu cho dữ liệu demo.', 'TEACHER', TRUE, now() - interval '180 days', now()),
  ('demo-student-01', 'hv01@demo.chineselearner.vn', '$2a$10$r7rBDrXyy2Zcta7wFSIrbuIfA5bG4FDcyFNTTc3AzPpgcO./260e6', 'Đỗ Thị Mai', '0922000001',
   'Mục tiêu thi HSK 3 trong năm nay.', 'STUDENT', TRUE, now() - interval '120 days', now()),
  ('demo-student-02', 'hv02@demo.chineselearner.vn', '$2a$10$r7rBDrXyy2Zcta7wFSIrbuIfA5bG4FDcyFNTTc3AzPpgcO./260e6', 'Ngô Văn Hùng', '0922000002',
   'Làm việc với đối tác Trung Quốc, cần viết email và họp.', 'STUDENT', TRUE, now() - interval '90 days', now()),
  ('demo-student-03', 'hv03@demo.chineselearner.vn', '$2a$10$r7rBDrXyy2Zcta7wFSIrbuIfA5bG4FDcyFNTTc3AzPpgcO./260e6', 'Phụ huynh bé Su', NULL,
   'Cho con 7 tuổi học YCT.', 'STUDENT', TRUE, now() - interval '60 days', now()),
  ('demo-student-04', 'hv04@demo.chineselearner.vn', '$2a$10$r7rBDrXyy2Zcta7wFSIrbuIfA5bG4FDcyFNTTc3AzPpgcO./260e6', 'Vũ Quốc Bảo', NULL,
   NULL, 'STUDENT', TRUE, now() - interval '45 days', now()),
  ('demo-student-05', 'hv05@demo.chineselearner.vn', '$2a$10$r7rBDrXyy2Zcta7wFSIrbuIfA5bG4FDcyFNTTc3AzPpgcO./260e6', 'Lý Thanh Tâm', NULL,
   'Mới bắt đầu, chưa mua khoá nào.', 'STUDENT', TRUE, now() - interval '3 days', now()),
  ('demo-student-06', 'hv06@demo.chineselearner.vn', '$2a$10$r7rBDrXyy2Zcta7wFSIrbuIfA5bG4FDcyFNTTc3AzPpgcO./260e6', 'Tài khoản bị khoá', NULL,
   'Dùng để thử: tài khoản bị khoá không đăng nhập được.', 'STUDENT', FALSE, now() - interval '30 days', now());

-- ---------------------------------------------------------------------------
-- Courses. sort_order starts at 10 so the four seed courses stay first.
-- ---------------------------------------------------------------------------
INSERT INTO courses (id, title, description, module, sort_order, is_free, is_published, teacher_id, created_at, updated_at) VALUES
  ('demo-course-easy2', 'Easy Steps 2 – Số đếm, màu sắc và đồ vật',
   'Tiếp nối Easy Steps 1: đếm từ 1 đến 100, gọi tên màu sắc và đồ vật quanh nhà. Mỗi bài 5–8 phút, có hình minh hoạ và trò chơi ôn tập.',
   'easy', 10, FALSE, TRUE, 'user-teacher-01', now() - interval '150 days', now()),
  ('demo-course-yct2', 'YCT 2 – Trường học và bạn bè',
   'Chương trình YCT 2 cho thiếu nhi: lớp học, đồ dùng học tập, giới thiệu bạn bè và sở thích. Bài ngắn, nhiều bài hát và hình ảnh.',
   'yct', 11, FALSE, TRUE, 'user-teacher-01', now() - interval '140 days', now()),
  ('demo-course-yct3', 'YCT 3 – Sắp ra mắt',
   'Khoá học đang được giáo viên chuẩn bị nội dung.',
   'yct', 12, FALSE, TRUE, 'user-teacher-01', now() - interval '5 days', now()),
  ('demo-course-pinyin', 'Phát âm chuẩn: pinyin và bốn thanh điệu',
   'Khoá miễn phí cho người mới: thanh mẫu, vận mẫu, bốn thanh điệu và biến điệu. Luyện theo từng âm khó với người Việt như zh, ch, sh, r, ü.',
   'hsk', 13, TRUE, TRUE, 'demo-teacher-ha', now() - interval '170 days', now()),
  ('demo-course-hsk2', 'HSK 2 – Mở rộng 300 từ và câu ghép',
   'Lộ trình HSK 2 sau khi xong HSK 1: câu so sánh, bổ ngữ kết quả, hội thoại đi chợ và hỏi đường. Có đề mẫu cuối khoá.',
   'hsk', 14, FALSE, TRUE, 'demo-teacher-minh', now() - interval '130 days', now()),
  ('demo-course-hsk3', 'HSK 3 – Luyện đề và nghe hiểu',
   'Đề mẫu HSK 3 có giải thích, kỹ năng nghe chép và đọc hiểu đoạn văn ngắn.',
   'hsk', 15, FALSE, TRUE, 'demo-teacher-minh', now() - interval '60 days', now()),
  ('demo-course-grammar', 'Ngữ pháp HSK 1–3 trong 20 bài',
   'Toàn bộ cấu trúc ngữ pháp sơ cấp, mỗi bài một điểm ngữ pháp kèm ví dụ chữ Hán, pinyin và nghĩa tiếng Việt.',
   'hsk', 16, TRUE, TRUE, 'demo-teacher-ha', now() - interval '20 days', now()),
  ('demo-course-hsk4-draft', 'HSK 4 – Bản nháp (chưa xuất bản)',
   'Khoá này chưa xuất bản: không được hiện trong danh mục.',
   'hsk', 17, FALSE, FALSE, 'demo-teacher-minh', now() - interval '2 days', now()),
  ('demo-course-office', 'Tiếng Trung công sở – Email, họp và báo cáo',
   'Mẫu câu viết email, gọi điện, họp và báo cáo tiến độ với đối tác Trung Quốc. Phù hợp người đi làm đã xong HSK 2.',
   'talk', 18, FALSE, TRUE, 'demo-teacher-ha', now() - interval '100 days', now()),
  ('demo-course-travel', 'Giao tiếp du lịch Trung Quốc',
   'Sân bay, khách sạn, gọi món, mặc cả và hỏi đường. Học xong đủ tự đi du lịch Thượng Hải, Bắc Kinh.',
   'talk', 19, FALSE, TRUE, 'demo-teacher-minh', now() - interval '10 days', now());

-- Test prices (not real prices). YCT 2 and the office course stay NULL:
-- paid but not on sale yet.
UPDATE courses SET price_vnd = 299000 WHERE id = 'demo-course-easy2';
UPDATE courses SET price_vnd = 599000 WHERE id = 'demo-course-hsk2';
UPDATE courses SET price_vnd = 699000 WHERE id = 'demo-course-hsk3';
UPDATE courses SET price_vnd = 2000 WHERE id = 'demo-course-travel';

-- ---------------------------------------------------------------------------
-- Lessons. All uploaded videos: `yarn db:demo` renders a short title card
-- for each one into uploads/videos/<storage_key>. The first lesson of every
-- paid course is a free preview.
-- ---------------------------------------------------------------------------
INSERT INTO lessons (id, course_id, title, description, duration, sort_order, is_free, source_type, storage_key, original_file_name, mime_type) VALUES
  ('demo-l-easy2-1', 'demo-course-easy2', 'Bài 1: Đếm từ 1 đến 10', 'Số đếm 一 到 十 và cách giơ tay đếm số kiểu Trung Quốc.', '6 phút', 0, TRUE, 'UPLOAD', 'videos/demo-l-easy2-1.webm', 'demo-l-easy2-1.webm', 'video/webm'),
  ('demo-l-easy2-2', 'demo-course-easy2', 'Bài 2: Số chục và số trăm', 'Ghép số: 十一, 二十, 九十九, 一百.', '7 phút', 1, FALSE, 'UPLOAD', 'videos/demo-l-easy2-2.webm', 'demo-l-easy2-2.webm', 'video/webm'),
  ('demo-l-easy2-3', 'demo-course-easy2', 'Bài 3: Màu sắc', '红色, 蓝色, 绿色, 黄色 và câu hỏi 这是什么颜色？', '8 phút', 2, FALSE, 'UPLOAD', 'videos/demo-l-easy2-3.webm', 'demo-l-easy2-3.webm', 'video/webm'),
  ('demo-l-easy2-4', 'demo-course-easy2', 'Bài 4: Đồ vật trong nhà', '桌子, 椅子, 杯子, 书 và lượng từ 个, 张, 本.', '8 phút', 3, FALSE, 'UPLOAD', 'videos/demo-l-easy2-4.webm', 'demo-l-easy2-4.webm', 'video/webm'),

  ('demo-l-yct2-1', 'demo-course-yct2', 'Bài 1: Lớp học của em', 'Từ vựng lớp học: 老师, 同学, 教室.', '7 phút', 0, TRUE, 'UPLOAD', 'videos/demo-l-yct2-1.webm', 'demo-l-yct2-1.webm', 'video/webm'),
  ('demo-l-yct2-2', 'demo-course-yct2', 'Bài 2: Đồ dùng học tập', '书包, 铅笔, 尺子 qua bài hát.', '6 phút', 1, FALSE, 'UPLOAD', 'videos/demo-l-yct2-2.webm', 'demo-l-yct2-2.webm', 'video/webm'),
  ('demo-l-yct2-3', 'demo-course-yct2', 'Bài 3: Bạn thân của em', 'Giới thiệu bạn: 他是我的好朋友.', '7 phút', 2, FALSE, 'UPLOAD', 'videos/demo-l-yct2-3.webm', 'demo-l-yct2-3.webm', 'video/webm'),

  ('demo-l-pinyin-1', 'demo-course-pinyin', 'Bài 1: Thanh mẫu', '21 thanh mẫu, nhóm âm dễ nhầm với tiếng Việt.', '12 phút', 0, TRUE, 'UPLOAD', 'videos/demo-l-pinyin-1.webm', 'demo-l-pinyin-1.webm', 'video/webm'),
  ('demo-l-pinyin-2', 'demo-course-pinyin', 'Bài 2: Vận mẫu', 'Vận mẫu đơn, kép và vận mẫu mũi.', '11 phút', 1, TRUE, 'UPLOAD', 'videos/demo-l-pinyin-2.webm', 'demo-l-pinyin-2.webm', 'video/webm'),
  ('demo-l-pinyin-3', 'demo-course-pinyin', 'Bài 3: Bốn thanh điệu', 'mā má mǎ mà và cách luyện bằng tay.', '10 phút', 2, TRUE, 'UPLOAD', 'videos/demo-l-pinyin-3.webm', 'demo-l-pinyin-3.webm', 'video/webm'),
  ('demo-l-pinyin-4', 'demo-course-pinyin', 'Bài 4: Biến điệu của 不 và 一', 'Khi nào 不 đọc bú, khi nào 一 đọc yí.', '9 phút', 3, TRUE, 'UPLOAD', 'videos/demo-l-pinyin-4.webm', 'demo-l-pinyin-4.webm', 'video/webm'),

  ('demo-l-hsk2-1', 'demo-course-hsk2', 'Bài 1: Ôn HSK 1 và mục tiêu HSK 2', 'Ôn nhanh 150 từ HSK 1, giới thiệu cấu trúc đề HSK 2.', '10 phút', 0, TRUE, 'UPLOAD', 'videos/demo-l-hsk2-1.webm', 'demo-l-hsk2-1.webm', 'video/webm'),
  ('demo-l-hsk2-2', 'demo-course-hsk2', 'Bài 2: Câu so sánh với 比', '我比他高。今天比昨天冷。', '14 phút', 1, FALSE, 'UPLOAD', 'videos/demo-l-hsk2-2.webm', 'demo-l-hsk2-2.webm', 'video/webm'),
  ('demo-l-hsk2-3', 'demo-course-hsk2', 'Bài 3: Bổ ngữ kết quả', '看完, 听懂, 写错 và cách phủ định.', '15 phút', 2, FALSE, 'UPLOAD', 'videos/demo-l-hsk2-3.webm', 'demo-l-hsk2-3.webm', 'video/webm'),
  ('demo-l-hsk2-4', 'demo-course-hsk2', 'Bài 4: Đi chợ, hỏi giá', '多少钱？太贵了，便宜一点儿吧。', '12 phút', 3, FALSE, 'UPLOAD', 'videos/demo-l-hsk2-4.webm', 'demo-l-hsk2-4.webm', 'video/webm'),
  ('demo-l-hsk2-5', 'demo-course-hsk2', 'Bài 5: Hỏi đường', '往左拐, 一直走, 离这儿远吗？', '13 phút', 4, FALSE, 'UPLOAD', 'videos/demo-l-hsk2-5.webm', 'demo-l-hsk2-5.webm', 'video/webm'),
  ('demo-l-hsk2-6', 'demo-course-hsk2', 'Bài 6: Đề mẫu HSK 2 có giải thích', 'Làm và chữa một đề mẫu đầy đủ.', '25 phút', 5, FALSE, 'UPLOAD', 'videos/demo-l-hsk2-6.webm', 'demo-l-hsk2-6.webm', 'video/webm'),

  ('demo-l-hsk3-1', 'demo-course-hsk3', 'Bài 1: Cấu trúc đề HSK 3', 'Nghe, đọc, viết: thời gian và cách tính điểm.', '9 phút', 0, TRUE, 'UPLOAD', 'videos/demo-l-hsk3-1.webm', 'demo-l-hsk3-1.webm', 'video/webm'),
  ('demo-l-hsk3-2', 'demo-course-hsk3', 'Bài 2: Kỹ năng nghe chép', 'Nghe chép câu ngắn, bắt từ khoá.', '16 phút', 1, FALSE, 'UPLOAD', 'videos/demo-l-hsk3-2.webm', 'demo-l-hsk3-2.webm', 'video/webm'),
  ('demo-l-hsk3-3', 'demo-course-hsk3', 'Bài 3: Đọc hiểu đoạn văn', 'Đọc lướt tìm ý chính, đoán nghĩa từ mới.', '18 phút', 2, FALSE, 'UPLOAD', 'videos/demo-l-hsk3-3.webm', 'demo-l-hsk3-3.webm', 'video/webm'),

  ('demo-l-grammar-1', 'demo-course-grammar', 'Bài 1: Câu chữ 是', '我是越南人。他不是老师。', '8 phút', 0, TRUE, 'UPLOAD', 'videos/demo-l-grammar-1.webm', 'demo-l-grammar-1.webm', 'video/webm'),
  ('demo-l-grammar-2', 'demo-course-grammar', 'Bài 2: Câu hỏi với 吗 và 呢', '你好吗？我很好，你呢？', '9 phút', 1, TRUE, 'UPLOAD', 'videos/demo-l-grammar-2.webm', 'demo-l-grammar-2.webm', 'video/webm'),
  ('demo-l-grammar-3', 'demo-course-grammar', 'Bài 3: Trợ từ 了', '了 sau động từ và cuối câu.', '12 phút', 2, TRUE, 'UPLOAD', 'videos/demo-l-grammar-3.webm', 'demo-l-grammar-3.webm', 'video/webm'),

  ('demo-l-office-1', 'demo-course-office', 'Bài 1: Chào hỏi đối tác', '您好，很高兴认识您。这是我的名片。', '10 phút', 0, TRUE, 'UPLOAD', 'videos/demo-l-office-1.webm', 'demo-l-office-1.webm', 'video/webm'),
  ('demo-l-office-2', 'demo-course-office', 'Bài 2: Viết email công việc', 'Mở đầu, nội dung, kết thư trang trọng.', '15 phút', 1, FALSE, 'UPLOAD', 'videos/demo-l-office-2.webm', 'demo-l-office-2.webm', 'video/webm'),
  ('demo-l-office-3', 'demo-course-office', 'Bài 3: Gọi điện và đặt lịch họp', '请问王经理在吗？我们约个时间吧。', '13 phút', 2, FALSE, 'UPLOAD', 'videos/demo-l-office-3.webm', 'demo-l-office-3.webm', 'video/webm'),
  ('demo-l-office-4', 'demo-course-office', 'Bài 4: Báo cáo tiến độ', 'Mẫu câu báo cáo, nêu vấn đề và đề xuất.', '14 phút', 3, FALSE, 'UPLOAD', 'videos/demo-l-office-4.webm', 'demo-l-office-4.webm', 'video/webm'),

  ('demo-l-travel-1', 'demo-course-travel', 'Bài 1: Ở sân bay', 'Làm thủ tục, hỏi cửa ra máy bay, lấy hành lý.', '11 phút', 0, TRUE, 'UPLOAD', 'videos/demo-l-travel-1.webm', 'demo-l-travel-1.webm', 'video/webm'),
  ('demo-l-travel-2', 'demo-course-travel', 'Bài 2: Nhận phòng khách sạn', '我预订了一个房间。可以早点儿入住吗？', '10 phút', 1, FALSE, 'UPLOAD', 'videos/demo-l-travel-2.webm', 'demo-l-travel-2.webm', 'video/webm'),
  ('demo-l-travel-3', 'demo-course-travel', 'Bài 3: Gọi món', '服务员，点菜！不要放辣椒。', '12 phút', 2, FALSE, 'UPLOAD', 'videos/demo-l-travel-3.webm', 'demo-l-travel-3.webm', 'video/webm'),
  ('demo-l-travel-4', 'demo-course-travel', 'Bài 4: Mặc cả khi mua sắm', '能便宜一点儿吗？我买两个。', '9 phút', 3, FALSE, 'UPLOAD', 'videos/demo-l-travel-4.webm', 'demo-l-travel-4.webm', 'video/webm'),

  ('demo-l-hsk4-1', 'demo-course-hsk4-draft', 'Bài 1: Giới thiệu HSK 4', 'Bản nháp.', '8 phút', 0, TRUE, 'UPLOAD', 'videos/demo-l-hsk4-1.webm', 'demo-l-hsk4-1.webm', 'video/webm');

-- ---------------------------------------------------------------------------
-- Vocabulary (real HSK words) for some demo lessons. Deleted with the lessons
-- above (ON DELETE CASCADE).
-- ---------------------------------------------------------------------------
INSERT INTO lesson_vocabulary (id, lesson_id, hanzi, pinyin, meaning_vi, example_zh, example_vi, sort_order) VALUES
  ('demo-v-easy2-1-01', 'demo-l-easy2-1', '一', 'yī', 'một', NULL, NULL, 0),
  ('demo-v-easy2-1-02', 'demo-l-easy2-1', '二', 'èr', 'hai', NULL, NULL, 1),
  ('demo-v-easy2-1-03', 'demo-l-easy2-1', '三', 'sān', 'ba', NULL, NULL, 2),
  ('demo-v-easy2-1-04', 'demo-l-easy2-1', '四', 'sì', 'bốn', NULL, NULL, 3),
  ('demo-v-easy2-1-05', 'demo-l-easy2-1', '五', 'wǔ', 'năm', NULL, NULL, 4),
  ('demo-v-easy2-1-06', 'demo-l-easy2-1', '六', 'liù', 'sáu', NULL, NULL, 5),
  ('demo-v-easy2-1-07', 'demo-l-easy2-1', '七', 'qī', 'bảy', NULL, NULL, 6),
  ('demo-v-easy2-1-08', 'demo-l-easy2-1', '八', 'bā', 'tám', NULL, NULL, 7),
  ('demo-v-easy2-1-09', 'demo-l-easy2-1', '九', 'jiǔ', 'chín', NULL, NULL, 8),
  ('demo-v-easy2-1-10', 'demo-l-easy2-1', '十', 'shí', 'mười', '我有十本书。', 'Tôi có mười quyển sách.', 9),
  ('demo-v-easy2-3-01', 'demo-l-easy2-3', '颜色', 'yánsè', 'màu sắc', '这是什么颜色？', 'Đây là màu gì?', 0),
  ('demo-v-easy2-3-02', 'demo-l-easy2-3', '红色', 'hóngsè', 'màu đỏ', NULL, NULL, 1),
  ('demo-v-easy2-3-03', 'demo-l-easy2-3', '蓝色', 'lánsè', 'màu xanh dương', NULL, NULL, 2),
  ('demo-v-easy2-3-04', 'demo-l-easy2-3', '绿色', 'lǜsè', 'màu xanh lá', NULL, NULL, 3),
  ('demo-v-easy2-3-05', 'demo-l-easy2-3', '黄色', 'huángsè', 'màu vàng', NULL, NULL, 4),
  ('demo-v-easy2-3-06', 'demo-l-easy2-3', '白色', 'báisè', 'màu trắng', NULL, NULL, 5),
  ('demo-v-easy2-3-07', 'demo-l-easy2-3', '黑色', 'hēisè', 'màu đen', NULL, NULL, 6),
  ('demo-v-pinyin-3-01', 'demo-l-pinyin-3', '妈', 'mā', 'mẹ (thanh 1)', NULL, NULL, 0),
  ('demo-v-pinyin-3-02', 'demo-l-pinyin-3', '麻', 'má', 'cây gai (thanh 2)', NULL, NULL, 1),
  ('demo-v-pinyin-3-03', 'demo-l-pinyin-3', '马', 'mǎ', 'con ngựa (thanh 3)', NULL, NULL, 2),
  ('demo-v-pinyin-3-04', 'demo-l-pinyin-3', '骂', 'mà', 'mắng (thanh 4)', NULL, NULL, 3),
  ('demo-v-pinyin-3-05', 'demo-l-pinyin-3', '吗', 'ma', 'trợ từ nghi vấn (thanh nhẹ)', '你好吗？', 'Bạn khoẻ không?', 4),
  ('demo-v-grammar-1-01', 'demo-l-grammar-1', '是', 'shì', 'là', '我是学生。', 'Tôi là học sinh.', 0),
  ('demo-v-grammar-1-02', 'demo-l-grammar-1', '不', 'bù', 'không', '他不是老师。', 'Anh ấy không phải là giáo viên.', 1),
  ('demo-v-grammar-1-03', 'demo-l-grammar-1', '也', 'yě', 'cũng', '我也是越南人。', 'Tôi cũng là người Việt Nam.', 2),
  ('demo-v-grammar-1-04', 'demo-l-grammar-1', '都', 'dōu', 'đều', '我们都是学生。', 'Chúng tôi đều là học sinh.', 3),
  ('demo-v-hsk2-1-01', 'demo-l-hsk2-1', '学习', 'xuéxí', 'học, học tập', '我学习汉语。', 'Tôi học tiếng Trung.', 0),
  ('demo-v-hsk2-1-02', 'demo-l-hsk2-1', '汉语', 'Hànyǔ', 'tiếng Hán, tiếng Trung', NULL, NULL, 1),
  ('demo-v-hsk2-1-03', 'demo-l-hsk2-1', '考试', 'kǎoshì', 'thi, kỳ thi', NULL, NULL, 2),
  ('demo-v-hsk2-1-04', 'demo-l-hsk2-1', '准备', 'zhǔnbèi', 'chuẩn bị', NULL, NULL, 3),
  ('demo-v-hsk2-1-05', 'demo-l-hsk2-1', '开始', 'kāishǐ', 'bắt đầu', NULL, NULL, 4),
  ('demo-v-hsk2-2-01', 'demo-l-hsk2-2', '比', 'bǐ', 'so với, hơn', '我比他高。', 'Tôi cao hơn anh ấy.', 0),
  ('demo-v-hsk2-2-02', 'demo-l-hsk2-2', '高', 'gāo', 'cao', NULL, NULL, 1),
  ('demo-v-hsk2-2-03', 'demo-l-hsk2-2', '矮', 'ǎi', 'thấp', NULL, NULL, 2),
  ('demo-v-hsk2-2-04', 'demo-l-hsk2-2', '冷', 'lěng', 'lạnh', NULL, NULL, 3),
  ('demo-v-hsk2-2-05', 'demo-l-hsk2-2', '热', 'rè', 'nóng', NULL, NULL, 4),
  ('demo-v-hsk2-2-06', 'demo-l-hsk2-2', '今天', 'jīntiān', 'hôm nay', '今天比昨天冷。', 'Hôm nay lạnh hơn hôm qua.', 5),
  ('demo-v-hsk2-2-07', 'demo-l-hsk2-2', '昨天', 'zuótiān', 'hôm qua', NULL, NULL, 6),
  ('demo-v-hsk2-4-01', 'demo-l-hsk2-4', '买', 'mǎi', 'mua', NULL, NULL, 0),
  ('demo-v-hsk2-4-02', 'demo-l-hsk2-4', '卖', 'mài', 'bán', NULL, NULL, 1),
  ('demo-v-hsk2-4-03', 'demo-l-hsk2-4', '贵', 'guì', 'đắt', '太贵了！', 'Đắt quá!', 2),
  ('demo-v-hsk2-4-04', 'demo-l-hsk2-4', '便宜', 'piányi', 'rẻ', '便宜一点儿吧。', 'Rẻ hơn một chút đi.', 3),
  ('demo-v-hsk2-4-05', 'demo-l-hsk2-4', '块', 'kuài', 'đồng (đơn vị tiền, khẩu ngữ)', NULL, NULL, 4),
  ('demo-v-hsk2-4-06', 'demo-l-hsk2-4', '多少钱', 'duōshao qián', 'bao nhiêu tiền', NULL, NULL, 5),
  ('demo-v-travel-1-01', 'demo-l-travel-1', '机场', 'jīchǎng', 'sân bay', NULL, NULL, 0),
  ('demo-v-travel-1-02', 'demo-l-travel-1', '飞机', 'fēijī', 'máy bay', NULL, NULL, 1),
  ('demo-v-travel-1-03', 'demo-l-travel-1', '护照', 'hùzhào', 'hộ chiếu', '请给我看一下护照。', 'Vui lòng cho tôi xem hộ chiếu.', 2),
  ('demo-v-travel-1-04', 'demo-l-travel-1', '行李', 'xíngli', 'hành lý', NULL, NULL, 3),
  ('demo-v-travel-1-05', 'demo-l-travel-1', '登机口', 'dēngjīkǒu', 'cửa ra máy bay', NULL, NULL, 4),
  ('demo-v-travel-3-01', 'demo-l-travel-3', '菜单', 'càidān', 'thực đơn', NULL, NULL, 0),
  ('demo-v-travel-3-02', 'demo-l-travel-3', '点菜', 'diǎn cài', 'gọi món', NULL, NULL, 1),
  ('demo-v-travel-3-03', 'demo-l-travel-3', '辣', 'là', 'cay', '不要太辣。', 'Đừng cay quá.', 2),
  ('demo-v-travel-3-04', 'demo-l-travel-3', '好吃', 'hǎochī', 'ngon', NULL, NULL, 3),
  ('demo-v-travel-3-05', 'demo-l-travel-3', '买单', 'mǎidān', 'thanh toán (ở nhà hàng)', '服务员，买单！', 'Em ơi, tính tiền!', 4),
  ('demo-v-office-1-01', 'demo-l-office-1', '认识', 'rènshi', 'quen biết', '很高兴认识您。', 'Rất vui được làm quen với ông/bà.', 0),
  ('demo-v-office-1-02', 'demo-l-office-1', '高兴', 'gāoxìng', 'vui', NULL, NULL, 1),
  ('demo-v-office-1-03', 'demo-l-office-1', '名片', 'míngpiàn', 'danh thiếp', NULL, NULL, 2),
  ('demo-v-office-1-04', 'demo-l-office-1', '公司', 'gōngsī', 'công ty', NULL, NULL, 3),
  ('demo-v-office-1-05', 'demo-l-office-1', '经理', 'jīnglǐ', 'giám đốc, quản lý', NULL, NULL, 4);

-- ---------------------------------------------------------------------------
-- Documents (files written by `yarn db:demo`; file_size filled in there).
-- ---------------------------------------------------------------------------
INSERT INTO course_documents (id, course_id, title, description, original_file_name, storage_key, file_type, mime_type, file_size, sort_order, is_free) VALUES
  ('demo-doc-easy2', 'demo-course-easy2', 'Bảng số đếm và màu sắc', 'In ra dán tường cho bé.', 'EasySteps2-SoDem-MauSac.doc', 'documents/demo-doc-easy2.doc', 'doc', 'application/msword', 0, 0, TRUE),
  ('demo-doc-hsk2-1', 'demo-course-hsk2', 'Từ vựng HSK 2 theo bài', 'Chữ Hán, pinyin và nghĩa tiếng Việt.', 'HSK2-TuVung.doc', 'documents/demo-doc-hsk2-1.doc', 'doc', 'application/msword', 0, 0, FALSE),
  ('demo-doc-hsk2-2', 'demo-course-hsk2', 'Đề mẫu HSK 2', 'Đề và đáp án có giải thích.', 'HSK2-DeMau.doc', 'documents/demo-doc-hsk2-2.doc', 'doc', 'application/msword', 0, 1, FALSE),
  ('demo-doc-pinyin', 'demo-course-pinyin', 'Bảng pinyin đầy đủ', 'Thanh mẫu, vận mẫu và ví dụ.', 'BangPinyin.doc', 'documents/demo-doc-pinyin.doc', 'doc', 'application/msword', 0, 0, TRUE),
  ('demo-doc-office', 'demo-course-office', 'Mẫu email công việc', '12 mẫu email thường dùng.', 'MauEmailCongViec.doc', 'documents/demo-doc-office.doc', 'doc', 'application/msword', 0, 0, FALSE),
  ('demo-doc-travel', 'demo-course-travel', 'Sổ tay câu du lịch', 'Bỏ túi khi đi du lịch.', 'SoTayDuLich.doc', 'documents/demo-doc-travel.doc', 'doc', 'application/msword', 0, 0, FALSE);

-- ---------------------------------------------------------------------------
-- Access. Covers: several courses, a revoked grant, a seed student with an
-- extra course, a teacher granting on another teacher's course (admin).
-- ---------------------------------------------------------------------------
INSERT INTO course_enrollments (id, course_id, student_id, granted_by_id, can_view, note) VALUES
  ('demo-e-01-hsk2', 'demo-course-hsk2', 'demo-student-01', 'demo-teacher-minh', TRUE, 'Đã chuyển khoản, lớp tháng 9 (dữ liệu demo).'),
  ('demo-e-01-hsk3', 'demo-course-hsk3', 'demo-student-01', 'demo-teacher-minh', TRUE, 'Học tiếp sau HSK 2 (dữ liệu demo).'),
  ('demo-e-02-office', 'demo-course-office', 'demo-student-02', 'demo-teacher-ha', TRUE, 'Công ty đăng ký (dữ liệu demo).'),
  ('demo-e-03-yct2', 'demo-course-yct2', 'demo-student-03', 'user-teacher-01', TRUE, NULL),
  ('demo-e-03-easy2', 'demo-course-easy2', 'demo-student-03', 'user-teacher-01', TRUE, NULL),
  ('demo-e-04-hsk2', 'demo-course-hsk2', 'demo-student-04', 'demo-teacher-minh', FALSE, 'Đã thu hồi quyền (dữ liệu demo).'),
  ('demo-e-a-hsk2', 'demo-course-hsk2', 'user-student-a', 'user-admin-01', TRUE, 'Học sinh A học tiếp HSK 2 (dữ liệu demo).');
