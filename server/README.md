# Backend – Vân Kính (`server/`)

Backend viết bằng **NestJS 10 + TypeScript + PostgreSQL (`pg` SQL thuần, không dùng Prisma)**, xác thực qua **HTTP-only Cookie**, quản lý hoàn toàn bằng **Yarn**.

## Cấu trúc thư mục
```text
server/
├── db/
│   ├── sql/
│   │   ├── 01_schema.sql       # DDL tạo bảng, khóa ngoại, index
│   │   ├── 02_master_data.sql  # Master data: roles, program_modules, admin mặc định
│   │   └── 03_seed_data.sql    # Dữ liệu mẫu: giáo viên, học sinh A/B, khóa học, video, phân quyền
│   ├── scripts/
│   │   └── db-cli.ts           # CLI thực thi db:init, db:generate, db:reset, db:seed, db:dump
│   └── dumps/                  # Thư mục xuất file .sql khi chạy yarn db:dump
├── src/
│   ├── database/               # DatabaseModule & DatabaseService (pg Pool)
│   ├── auth/                   # Login, Register, Logout (Cookie), Profile, Change Password
│   ├── users/                  # Quản lý người dùng & vai trò (Admin)
│   ├── courses/                # Quản lý khóa học & kiểm tra quyền theo enrollment
│   ├── lessons/                # Video YouTube & Upload + HTTP Range Streaming
│   ├── documents/              # Upload & Download tài liệu .doc/.docx/.ppt/.pptx
│   ├── enrollments/            # Cấp quyền / Thu hồi quyền xem khóa học cho học sinh
│   └── common/                 # Guards, Decorators, StorageService, Types, YouTube Parser
├── Dockerfile                  # Dùng khi build triển khai lên GCP Cloud Run
└── package.json
```

## Cấu hình & chạy bằng Yarn

### 1. Tạo file `.env`
```bash
cp .env.example .env
```

### 2. Cài đặt dependencies
```bash
yarn install
```

### 3. Các lệnh quản trị Database (SQL thuần)
```bash
yarn db:init      # Tạo database PostgreSQL nếu chưa có
yarn db:generate  # Chạy 01_schema.sql tạo bảng & index
yarn db:reset     # Xóa & tạo lại toàn bộ bảng + nạp 02_master_data.sql
yarn db:seed      # Nạp dữ liệu mẫu từ 03_seed_data.sql
yarn db:dump      # Lưu bản cũ ra db/dumps/backup_YYYYMMDD_HHmm.sql rồi đẩy hiện trạng DB vào 01_schema.sql & 03_seed_data.sql (giữ nguyên 02_master_data.sql)
```

### 4. Chạy dev & build production
```bash
yarn dev          # Chạy NestJS watch mode (http://localhost:4000/api)
yarn build        # Build ra thư mục dist/
yarn start:prod   # Chạy production từ dist/main.js
```

## Danh sách API chính

| Nhóm | Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|---|
| Health | `GET` | `/api/health` | Public | Kiểm tra trạng thái server & PostgreSQL |
| Auth | `POST` | `/api/auth/register` | Public | Đăng ký Học sinh & set HTTP-only cookie |
| Auth | `POST` | `/api/auth/login` | Public | Đăng nhập & set HTTP-only cookie |
| Auth | `POST` | `/api/auth/logout` | Public | Xóa cookie đăng nhập |
| Auth | `GET` | `/api/auth/me` | Đã đăng nhập | Lấy thông tin tài khoản từ cookie |
| Auth | `PATCH` | `/api/auth/profile` | Đã đăng nhập | Sửa thông tin cá nhân (`fullName`, `phone`, `bio`) |
| Auth | `PATCH` | `/api/auth/password` | Đã đăng nhập | Đổi mật khẩu tài khoản |
| Users | `GET/POST` | `/api/users` | `ADMIN` | Danh sách / Tạo người dùng |
| Users | `PATCH/DELETE` | `/api/users/:id` | `ADMIN` | Đổi role, khóa/mở khóa, xóa |
| Users | `GET` | `/api/users/stats` | `ADMIN` | Thống kê hệ thống |
| Courses | `GET` | `/api/courses` | Public / Cookie | Danh sách khóa học (ẩn nguồn video/tài liệu nếu chưa có quyền) |
| Courses | `GET/POST/DELETE` | `/api/courses/manage`, `/api/courses` | `ADMIN`, `TEACHER` | Quản lý khóa học |
| Lessons | `POST` | `/api/lessons/youtube`, `/api/lessons/upload` | `ADMIN`, `TEACHER` | Thêm video YouTube hoặc upload file |
| Lessons | `GET` | `/api/lessons/:id/stream` | Miễn phí / Có quyền | Stream video HTML5 (HTTP Range) xác thực qua cookie |
| Documents | `POST` | `/api/documents/upload` | `ADMIN`, `TEACHER` | Upload `.doc/.docx/.ppt/.pptx` |
| Documents | `GET` | `/api/documents/:id/download` | Miễn phí / Có quyền | Tải tài liệu về máy xác thực qua cookie |
| Enrollments | `GET/POST` | `/api/enrollments/course/:id`, `/api/enrollments/access` | `ADMIN`, `TEACHER` | Xem & bật/tắt quyền học sinh theo khóa |
| Enrollments | `GET` | `/api/enrollments/my` | Đã đăng nhập | Danh sách khóa học học sinh đã được cấp quyền |
