# Hướng dẫn chạy Local – Chinese Learner

Kiến trúc chạy local:
- **PostgreSQL 16**: chạy trong **Docker Compose** (`docker-compose.yml`).
- **Backend (`server`)** và **Frontend (`user-client`)**: chạy trực tiếp bằng **Yarn** trên 2 terminal tách riêng.
- **Database**: dùng **SQL thuần** (không dùng Prisma).

---

## Bước 1: Chuẩn bị file biến môi trường

```bash
# Tự động tạo .env, server/.env và user-client/.env.local từ .env.example
yarn env

# (Nếu muốn ghi đè làm mới toàn bộ file env về mặc định)
yarn env:force
```

> **Lưu ý nếu gặp lỗi `Authentication failed` khi kết nối cổng `5432` trên Windows:**
> Nhiều máy Windows đã cài sẵn PostgreSQL local chiếm sẵn cổng `5432`, khiến kết nối đi nhầm vào Postgres cũ thay vì Docker container!
> **Cách xử lý nhanh:** Đổi `POSTGRES_PORT=5433` trong cả `.env` (gốc) và `server/.env`, sau đó chạy lại `yarn db:down && yarn db:up`.

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

## Bước 3: Cài dependencies cho Server & Client (tách riêng)

```bash
yarn server:install
yarn client:install
```

---

## Bước 4: Khởi tạo & thao tác Database bằng SQL thuần

Chạy từ thư mục gốc (hoặc chạy trực tiếp trong thư mục `server/`):

```bash
# 1. Tạo database (nếu chưa có)
yarn db:init

# 2. Tạo bảng & index từ server/db/sql/01_schema.sql
yarn db:generate

# 3. Reset sạch bảng & nạp master data (roles, program_modules, admin mặc định)
yarn db:reset

# 4. Nạp dữ liệu mẫu (teacher, studentA, studentB, khóa học, video, tài liệu, phân quyền)
yarn db:seed

# 5. Sao lưu bản cũ ra server/db/dumps/backup_YYYYMMDD_HHmm.sql và đẩy hiện trạng DB hiện tại vào 01_schema.sql & 03_seed_data.sql (giữ nguyên 02_master_data.sql)
yarn db:dump
```

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

## Bước 6: Kiểm thử nhanh xác thực Cookie, Hồ sơ cá nhân & 3 Vai trò

1. Vào `http://localhost:3000/login` → đăng nhập bằng 1 trong 4 tài khoản mẫu (Admin / Giáo viên / Học sinh A / Học sinh B).
2. Nhấn **F5 tải lại trang**: phiên đăng nhập vẫn được duy trì tự động nhờ **HTTP-only Cookie** (`chinese_learner_token`).
3. Bấm vào **tên tài khoản trên thanh Header** → mở trang `/profile` để kiểm thử **cập nhật họ tên, số điện thoại, giới thiệu** và **đổi mật khẩu**.
4. Đăng nhập **Giáo viên** (`teacher@chineselearner.vn` / `Teacher@123`) → vào tab **Giáo viên**:
   - Tạo khóa học, thêm link YouTube hoặc upload video `.mp4`, upload tài liệu `.doc/.docx/.ppt/.pptx`.
   - Sang tab **4. Cấp quyền Học sinh** để bật/tắt quyền xem khóa học HSK 1 cho Học sinh A / Học sinh B.
5. Bấm **Đăng xuất** → cookie được xóa sạch khỏi trình duyệt.
