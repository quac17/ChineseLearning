# Kiến trúc hệ thống – Chinese Learner

## 1. Tổng quan

```text
[Trình duyệt: Admin / Giáo viên / Học sinh]
   │  HTTP-only Cookie (chinese_learner_token)
   ▼
┌──────────────────────────────┐
│  user-client (Next.js 14)    │  Port 3000 (chạy riêng bằng yarn client:dev)
└──────────────┬───────────────┘
               │ fetch(..., { credentials: 'include' })
               ▼
┌──────────────────────────────┐
│  server (NestJS 10 + pg)     │  Port 4000 (chạy riêng bằng yarn server:dev)
└──────┬───────────────┬───────┘
       │               │
       ▼               ▼
┌───────────────┐ ┌──────────────────────────┐
│ PostgreSQL 16 │ │ Kho lưu trữ Media        │
│ (Docker + SQL │ │ uploads/videos/          │
│  thuần)       │ │ uploads/documents/       │
└───────────────┘ └──────────────────────────┘
```

## 2. Duy trì đăng nhập qua Cookie & Hồ sơ cá nhân
- Khi đăng nhập (`/api/auth/login`) hoặc đăng ký (`/api/auth/register`), Backend ký JWT và ghi vào **HTTP-only Cookie** (`chinese_learner_token`, thời hạn 7 ngày).
- Frontend không lưu token vào `localStorage`; mọi request API, stream video `<video>` và tải tài liệu `<a>` đều tự động gửi kèm cookie.
- Khi đăng xuất (`/api/auth/logout`), Backend xóa cookie ngay lập tức.
- Người dùng ở mọi vai trò có thể truy cập `/profile` để sửa họ tên, số điện thoại, giới thiệu bản thân (`PATCH /api/auth/profile`) và đổi mật khẩu (`PATCH /api/auth/password`).

## 3. Quản lý Database bằng SQL thuần (`server/db/`)
- `01_schema.sql`: 7 bảng (`roles`, `program_modules`, `users`, `courses`, `lessons`, `course_documents`, `course_enrollments`) + khóa ngoại + index.
- `02_master_data.sql`: dữ liệu nền (3 vai trò, 4 chương trình học, tài khoản Admin mặc định).
- `03_seed_data.sql`: dữ liệu mẫu kiểm thử (Giáo viên, Học sinh A/B, 4 khóa học, 5 video, 1 tài liệu mẫu và phân quyền mẫu).
- `db-cli.ts`: hỗ trợ 5 lệnh `db:init`, `db:generate`, `db:reset`, `db:seed`, `db:dump`.

## 4. Ma trận phân quyền 3 vai trò (RBAC)

| Quyền hạn | Admin | Teacher | Student | Khách |
|---|:---:|:---:|:---:|:---:|
| Sửa thông tin cá nhân & đổi mật khẩu (`/profile`) | ✅ | ✅ | ✅ | ❌ |
| Xem bài giảng & tải tài liệu miễn phí | ✅ | ✅ | ✅ | ✅ |
| Xem video & tải tài liệu khóa học có phân quyền | ✅ | ✅ (khóa của mình) | ✅ nếu `course_enrollments.can_view = TRUE` | ❌ |
| Tạo/Xóa khóa học, Upload Video/YouTube, Upload DOC/PPT | ✅ | ✅ (khóa của mình) | ❌ | ❌ |
| Cấp quyền / Thu hồi quyền học sinh theo khóa | ✅ | ✅ (khóa của mình) | ❌ | ❌ |
| Quản lý tài khoản & đổi Role người dùng | ✅ | ❌ | ❌ | ❌ |
