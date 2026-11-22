# Chinese Learner – Nền tảng học tiếng Trung cho người Việt

Nền tảng học tiếng Trung theo giao diện **Chinese Learner** (đổi bảng màu theo chương trình học Easy Steps / YCT / HSK / Giao tiếp, nền sóng thủy mặc, Sáng/Tối), xây dựng với **NestJS (Backend)** + **Next.js (Frontend)** + **PostgreSQL (SQL thuần, không dùng ORM/Prisma)**, duy trì đăng nhập bằng **HTTP-only Cookie**, quản lý bằng **Yarn** với lệnh chạy BE/FE tách riêng, và chạy Database trên **Docker Compose**.

---

## Cấu trúc thư mục

```text
ChineseLeaning/
├── server/               # Backend NestJS + PostgreSQL SQL thuần (pg) + Cookie Auth
│   ├── db/
│   │   ├── sql/          # 01_schema.sql, 02_master_data.sql, 03_seed_data.sql
│   │   ├── scripts/      # db-cli.ts (init / generate / reset / seed / dump)
│   │   └── dumps/        # Nơi lưu file SQL sau khi chạy yarn db:dump
│   └── README.md         # Hướng dẫn riêng cho Backend
├── user-client/          # Frontend Next.js 14 (App Router) giao diện Chinese Learner
│   └── README.md         # Hướng dẫn riêng cho Frontend
├── tmp/                  # Tài liệu hướng dẫn chạy local, DB SQL, tên miền, CI/CD & deploy GCP
│   ├── HUONG-DAN-CHAY-LOCAL.md
│   ├── HUONG-DAN-DEPLOY-GCP.md
│   ├── HUONG-DAN-GAN-TEN-MIEN.md
│   ├── HUONG-DAN-CICD-GITHUB.md
│   └── KIEN-TRUC-HE-THONG.md
├── docker-compose.yml    # Chỉ chạy PostgreSQL 16 Container
├── package.json          # Lệnh Yarn tách riêng cho DB, Server và Client
├── .gitignore
└── .env.example
```

---

## Tính năng chính

1. **Xác thực & Hồ sơ cá nhân (Cookie Auth)**:
   - Đăng ký, đăng nhập, đăng xuất duy trì phiên tự động qua **HTTP-only Cookie** (`chinese_learner_token`).
   - Trang **Thông tin cá nhân (`/profile`)**: cập nhật họ tên, số điện thoại, giới thiệu bản thân và đổi mật khẩu.
2. **Phân quyền 3 vai trò (`ADMIN`, `TEACHER`, `STUDENT`)**:
   - **Admin**: Quản trị tài khoản người dùng (tạo mới, đổi role, khóa/mở khóa, xóa) + thống kê hệ thống + quản lý khóa học.
   - **Giáo viên**: Tạo/xóa khóa học; đăng video từ **file upload** hoặc **link YouTube**; đẩy tài liệu Word/PowerPoint (`.doc`, `.docx`, `.ppt`, `.pptx`); **cấp quyền / thu hồi quyền** xem khóa học cho từng học sinh.
   - **Học sinh**: Xem video HTML5 hoặc YouTube nhúng theo quyền khóa học, tải tài liệu về máy, học **Flashcard 3D**, **Quiz 4 dạng**, **Luyện viết chữ Hán**.

---

## Các lệnh Yarn tách riêng (tại thư mục gốc)

### 0. Khởi tạo file biến môi trường (`.env`, `server/.env`, `user-client/.env.local`, `.env.dev`, `.env.prd`)
```bash
yarn env            # Tạo các file .env còn thiếu từ .env.example (không ghi đè file đã có)
yarn env:force      # Ghi đè làm mới toàn bộ file .env từ .env.example
yarn env_dev        # Tạo file .env.dev tổng hợp cho môi trường dev từ .env.dev.example
yarn env_dev:force  # Ghi đè làm mới file .env.dev từ .env.dev.example
yarn env_prd        # Tạo file .env.prd tổng hợp cho môi trường production từ .env.prd.example
yarn env_prd:force  # Ghi đè làm mới file .env.prd từ .env.prd.example
```

### 1. Database (PostgreSQL trên Docker + SQL thuần)
```bash
yarn db:up          # Khởi chạy container PostgreSQL
yarn db:init        # Tạo database nếu chưa tồn tại
yarn db:generate    # Tạo schema & các bảng (01_schema.sql)
yarn db:reset       # Reset toàn bộ bảng và nạp master data (01_schema.sql + 02_master_data.sql)
yarn db:seed        # Nạp dữ liệu mẫu (03_seed_data.sql)
yarn db:dump        # Sao lưu bản cũ ra server/db/dumps/backup_YYYYMMDD_HHmm.sql rồi đẩy hiện trạng DB vào 01_schema.sql & 03_seed_data.sql (giữ nguyên master)
yarn db:down        # Tắt container PostgreSQL
```

### 2. Backend (`server/`) — chạy riêng ở Terminal 1
```bash
yarn server:install
yarn server:dev     # Chạy dev tại http://localhost:4000/api
yarn server:build   # Build production
yarn server:start   # Chạy bản production
```

### 3. Frontend (`user-client/`) — chạy riêng ở Terminal 2
```bash
yarn client:install
yarn client:dev     # Chạy dev tại http://localhost:3000
yarn client:build   # Build production
yarn client:start   # Chạy bản production
```

---

## Tài khoản mẫu (sau khi chạy `yarn db:seed`)

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| **Admin** | `admin@chineselearner.vn` | `Admin@123` | Quản trị toàn bộ hệ thống |
| **Giáo viên** | `teacher@chineselearner.vn` | `Teacher@123` | Tạo khóa học, upload video/tài liệu & cấp quyền |
| **Học sinh A** | `studentA@chineselearner.vn` | `Student@123` | Đã được cấp quyền khóa **HSK 1** |
| **Học sinh B** | `studentB@chineselearner.vn` | `Student@123` | Chưa được cấp quyền khóa trả phí |

Xem thêm hướng dẫn chi tiết tại [tmp/HUONG-DAN-CHAY-LOCAL.md](./tmp/HUONG-DAN-CHAY-LOCAL.md) và [tmp/HUONG-DAN-DEPLOY-GCP.md](./tmp/HUONG-DAN-DEPLOY-GCP.md).
