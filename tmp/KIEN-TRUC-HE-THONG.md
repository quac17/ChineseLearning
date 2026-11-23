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
┌───────────────┐ ┌──────────────────────────────────────┐
│ PostgreSQL 16 │ │ Kho lưu trữ Media (StorageService)   │
│ (Docker/Cloud │ │ - Local: server/uploads/             │
│  SQL + SQL    │ │ - Prod:  GCS private bucket          │
│  thuần)       │ │          (Signed URL Upload/Stream)  │
└───────────────┘ └──────────────────────────────────────┘
```

## 2. Duy trì đăng nhập qua Cookie & Tài khoản
- Khi đăng nhập (`/api/auth/login`) hoặc đăng ký (`/api/auth/register`), Backend ký JWT và ghi vào **HTTP-only Cookie** (`chinese_learner_token`, thời hạn mặc định 7 ngày).
- Frontend không lưu token vào `localStorage`; mọi request API qua `apiRequest` đều dùng `credentials: 'include'`.
- Khi đăng xuất (`/api/auth/logout`), Backend xóa cookie ngay lập tức.
- Người dùng ở mọi vai trò có thể truy cập `/account` để sửa họ tên, số điện thoại, giới thiệu bản thân, bật/tắt nhắc ôn tập mỗi ngày và đổi mật khẩu (hỗ trợ cả luồng quên mật khẩu `/forgot-password` → `/reset-password` qua email).

## 3. Quản lý Database bằng SQL thuần (`server/db/`)
- `server/db/sql/`:
  - `01_schema.sql`: toàn bộ bảng, khóa ngoại, index (users, courses, sections, lessons, lesson_vocabulary, lesson_subtitles, lesson_progress, lesson_notes_qa, course_documents, course_enrollments, orders, payments, course_reviews, vocab_reviews, password_resets, ...).
  - `02_master_data.sql`: dữ liệu nền (3 vai trò, 4 chương trình học `Easy Steps`, `YCT`, `HSK`, `Giao tiếp`, tài khoản Admin mặc định).
  - `03_seed_data.sql`: dữ liệu mẫu chuẩn cho kiểm thử & E2E (Giáo viên, Học sinh A/B, khóa học, bài giảng, tài liệu và phân quyền mẫu).
  - `04_demo_data.sql`: dữ liệu demo mở rộng (`yarn db:demo`, chỉ dùng ở local).
- `server/db/migrations/`: các file migration idempotent theo thứ tự `YYYYMMDD_HHMM_*.sql` để nâng cấp database đang chạy (production).
- `db-cli.ts`: hỗ trợ các lệnh `db:init`, `db:generate`, `db:reset`, `db:seed`, `db:demo`, `db:dump`.

## 4. Lưu trữ Media & Thanh toán
- **Media (`StorageService`)**:
  - Local (`STORAGE_BACKEND=local`): lưu vào `server/uploads/videos/`, `documents/`, `covers/`, `subtitles/`.
  - Production (`STORAGE_BACKEND=gcs`): lưu vào **Google Cloud Storage bucket riêng tư**. Giáo viên upload video lớn trực tiếp từ trình duyệt lên bucket bằng Signed URL (`PUT`); học viên xem video / tải tài liệu qua Signed URL thời hạn ngắn (mặc định 15 phút) **sau khi** backend kiểm tra quyền truy cập.
- **Thanh toán (`PaymentsModule`)**:
  - Hỗ trợ cổng PayOS (`PAYMENT_GATEWAY=payos`, VietQR + webhook có chữ ký `PAYOS_CHECKSUM_KEY`, idempotent) và cổng giả lập (`PAYMENT_GATEWAY=fake`) cho local/test (tự động chặn ở `NODE_ENV=production`).

## 5. Ma trận phân quyền 3 vai trò (RBAC)

| Quyền hạn | Admin | Teacher | Student | Khách |
|---|:---:|:---:|:---:|:---:|
| Sửa thông tin cá nhân & đổi mật khẩu (`/account`) | ✅ | ✅ | ✅ | ❌ |
| Xem bài giảng miễn phí / bài học thử (`is_free`) & tải tài liệu miễn phí | ✅ | ✅ | ✅ | ✅ |
| Xem video & tải tài liệu khóa học trả phí | ✅ | ✅ (khóa của mình) | ✅ nếu `course_enrollments.can_view = TRUE` | ❌ |
| Mua khóa học qua PayOS / đánh giá khóa học | ✅ | ✅ | ✅ | ❌ |
| Học Flashcard 3D, ôn tập Leitner, Quiz, Luyện viết, Ghi chú & Hỏi đáp | ✅ | ✅ | ✅ | ❌ |
| Tạo/Sửa/Xóa khóa học, Chương/Bài học, Upload Video/YouTube/Phụ đề/DOC/PPT | ✅ | ✅ (khóa của mình) | ❌ | ❌ |
| Cấp quyền / Thu hồi quyền học sinh theo khóa | ✅ | ✅ (khóa của mình) | ❌ | ❌ |
| Quản lý tài khoản, giá khóa học, đơn hàng, kiểm duyệt khóa & đánh giá (`/admin/*`) | ✅ | ❌ | ❌ | ❌ |
