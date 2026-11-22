-- ============================================================================
-- Chinese Learner - Master Data
-- Chạy tự động khi dùng `yarn db:reset`
-- ============================================================================

-- 1. Master Roles (3 vai trò cốt lõi)
INSERT INTO roles (code, name, description) VALUES
  ('ADMIN', 'Quản trị viên', 'Toàn quyền quản trị người dùng, phân vai trò và quản lý toàn bộ khóa học'),
  ('TEACHER', 'Giáo viên', 'Quản lý khóa học, đăng video/YouTube, đẩy tài liệu DOC/PPT và cấp quyền học sinh'),
  ('STUDENT', 'Học sinh', 'Xem video theo khóa học được cấp quyền, tải tài liệu và học Flashcard/Quiz/Viết chữ Hán')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 2. Master Program Modules (4 chương trình học)
INSERT INTO program_modules (code, name, han, card_desc, description, color_1, color_2, sort_order) VALUES
  ('easy', 'Easy Steps', '易', 'Cho bé và người mới bắt đầu', 'Những bước đầu tiên, nhẹ nhàng như lá non đầu xuân.', '#4e7d2f', '#d99a2b', 1),
  ('yct', 'YCT', '少', 'Chứng chỉ cho thiếu nhi', 'Rực rỡ như tranh Đôn Hoàng, vui học cho thiếu nhi.', '#c25a18', '#1f7a7a', 2),
  ('hsk', 'HSK', '考', 'Lộ trình HSK 1–6', 'Sóng ngọc lam và đường vàng, vững bước từng cấp.', '#0f7c90', '#b58a2e', 3),
  ('talk', 'Giao tiếp', '说', 'Hội thoại đời sống, thương mại', 'Hội thoại đời sống, sắc tím lam của hoa sen đêm.', '#4b4fa8', '#c0508a', 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  han = EXCLUDED.han,
  card_desc = EXCLUDED.card_desc,
  description = EXCLUDED.description,
  color_1 = EXCLUDED.color_1,
  color_2 = EXCLUDED.color_2,
  sort_order = EXCLUDED.sort_order;

-- 3. Tài khoản Admin gốc (Mật khẩu: Admin@123)
INSERT INTO users (id, email, password_hash, full_name, phone, bio, role, is_active) VALUES
  (
    'user-admin-01',
    'admin@chineselearner.vn',
    '$2a$10$B44QdFVX82j.ZHbeUnmi8.0o102l6k0Ol30CsFDVMB4ltHr8cdF9O',
    'Quản trị viên Chinese Learner',
    '0900000001',
    'Quản trị hệ thống nền tảng học tiếng Trung Chinese Learner.',
    'ADMIN',
    TRUE
  )
ON CONFLICT (email) DO NOTHING;
