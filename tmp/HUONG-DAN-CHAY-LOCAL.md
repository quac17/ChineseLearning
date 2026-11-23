# Hướng dẫn chạy Local – Chinese Learner

Kiến trúc chạy local:
- **Node.js 20** + **Yarn 1.x**.
- **PostgreSQL 16**: chạy trong **Docker Compose** (`docker-compose.yml`, mặc định cổng **5433**).
- **Backend (`server`)** và **Frontend (`user-client`)**: chạy trực tiếp bằng **Yarn** trên 2 terminal tách riêng.
- **Database**: dùng **SQL thuần** (`pg`, không dùng ORM/Prisma).

---

## Bước 1: Chuẩn bị file biến môi trường

```bash
# Tự động tạo .env, server/.env và user-client/.env.local từ .env.example (không ghi đè file đã có)
yarn env

# (Nếu muốn ghi đè làm mới toàn bộ file env về mặc định)
yarn env:force
```

> **Lưu ý về cổng PostgreSQL (`5433`):**
> Mặc định `.env.example` và `docker-compose.yml` dùng cổng **`5433`** để tránh đụng với PostgreSQL cài sẵn trên máy (thường chiếm cổng `5432`).
> Nếu cần đổi cổng khác, sửa `POSTGRES_PORT` trong cả `.env` (gốc) và `server/.env`, sau đó chạy lại `yarn db:down && yarn db:up`.

---

## Bước 2: Khởi chạy PostgreSQL trên Docker Compose

```bash
yarn db:up
```
Kiểm tra container đang chạy:
```bash
docker ps
```

---

## Bước 3: Cài dependencies cho Root, Server & Client

```bash
yarn install
yarn server:install
yarn client:install
```

*(Tùy chọn)* Cài đặt Git `pre-push` hook để tự động chạy kiểm tra CI trước mỗi lần `git push`:
```bash
yarn hooks:install
```

---

## Bước 4: Khởi tạo & thao tác Database bằng SQL thuần

Chạy từ thư mục gốc:

```bash
# 1. Tạo database (nếu chưa có)
yarn db:init

# 2. Tạo bảng & index từ server/db/sql/01_schema.sql
yarn db:generate

# 3. Reset sạch bảng & nạp master data (roles, program_modules, admin mặc định)
yarn db:reset

# 4. Nạp dữ liệu mẫu cho E2E & kiểm thử cơ bản (teacher, studentA, studentB, khóa học, video, tài liệu, phân quyền)
yarn db:seed

# 5. (Tùy chọn) Nạp thêm dữ liệu demo phong phú chồng lên seed (chỉ dùng cho DB local)
yarn db:demo

# 6. Sao lưu bản cũ ra server/db/dumps/backup_YYYYMMDD_HHmm.sql và đẩy hiện trạng DB hiện tại vào 01_schema.sql & 03_seed_data.sql (giữ nguyên 02_master_data.sql)
yarn db:dump
```

> Lưu ý: `yarn db:demo` tạo thêm các khóa học/tài khoản `demo-*` và dùng Chromium của Playwright để sinh video mẫu trong `server/uploads/videos/`.

---

## Bước 5: Chạy Server và Client ở 2 Terminal tách riêng

### Terminal 1 – Chạy Backend (NestJS)
```bash
yarn server:dev
```
Backend chạy tại: `http://localhost:4000/api` (kiểm tra nhanh: `http://localhost:4000/api/health`).

### Terminal 2 – Chạy Frontend (Next.js)
```bash
yarn client:dev
```
Frontend chạy tại: `http://localhost:3000`.

### Build Production tách riêng
```bash
yarn server:build
yarn client:build
```

---

## Bước 6: Kiểm tra CI & E2E ở Local

```bash
# Chạy toàn bộ kiểm tra CI giống GitHub Actions (Server type-check + build + Jest, Client type-check + build)
yarn check:ci

# Chạy E2E Playwright (tự động dùng DB test chinese_learner_test)
yarn e2e

# Chạy cả CI + E2E
yarn check:all
```

---

## Bước 7: Kiểm thử nhanh xác thực Cookie, Hồ sơ, Thanh toán & 3 Vai trò

1. Vào `http://localhost:3000/login` → đăng nhập bằng 1 trong 4 tài khoản mẫu (`Admin@123` / `Teacher@123` / `Student@123`):
   - Admin: `admin@chineselearner.vn`
   - Giáo viên: `teacher@chineselearner.vn`
   - Học sinh A: `studentA@chineselearner.vn` (đã có quyền khóa **HSK 1**)
   - Học sinh B: `studentB@chineselearner.vn` (chưa có quyền khóa trả phí)
2. Nhấn **F5 tải lại trang**: phiên đăng nhập vẫn được duy trì tự động nhờ **HTTP-only Cookie** (`chinese_learner_token`).
3. Bấm vào **tên tài khoản trên thanh Header** → mở trang `/account` để kiểm thử **cập nhật họ tên, số điện thoại, giới thiệu**, **bật/tắt nhắc ôn tập** và **đổi mật khẩu**.
4. Đăng nhập **Giáo viên** (`teacher@chineselearner.vn`) → vào trang `/teacher/courses`:
   - Tạo/chỉnh sửa khóa học, chương/bài học, thêm link YouTube hoặc upload video `.mp4`, phụ đề, từ vựng, upload tài liệu `.doc/.docx/.ppt/.pptx`.
   - Mở chế độ **Xem trước (Review)** khóa học của mình để kiểm tra toàn bộ bài học/video như góc nhìn học viên.
   - Vào mục quản lý học viên của khóa để cấp/thu hồi quyền xem khóa học cho Học sinh A / Học sinh B.
5. **Kiểm thử mua khóa học (PayOS giả lập ở local):**
   - Mặc định `PAYMENT_GATEWAY=fake` trong `server/.env`. Khi học sinh bấm mua khóa học có giá, trang `/checkout/[orderId]` hiển thị QR mẫu và nút **"Giả lập: đã thanh toán"** để kích hoạt webhook giả lập và mở khóa ngay lập tức.
6. Bấm **Đăng xuất** → cookie được xóa sạch khỏi trình duyệt.
