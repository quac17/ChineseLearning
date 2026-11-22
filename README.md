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

## Phát triển cùng AI (Claude Code, Codex, Gemini CLI)

Hướng dẫn chung cho mọi AI nằm ở [AGENTS.md](./AGENTS.md); quy tắc code & checklist review ở [CODING_STANDARDS.md](./CODING_STANDARDS.md); thuật ngữ ở [GLOSSARY.md](./GLOSSARY.md). Skill nằm trong `.agents/skills/` (Claude đọc qua symlink `.claude/skills`).

Sau khi clone, cài thêm các skill không được commit (vì license):
```bash
yarn skills:install
```

---

## Tài khoản mẫu (sau khi chạy `yarn db:seed`)

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| **Admin** | `admin@chineselearner.vn` | `Admin@123` | Quản trị toàn bộ hệ thống |
| **Giáo viên** | `teacher@chineselearner.vn` | `Teacher@123` | Tạo khóa học, upload video/tài liệu & cấp quyền |
| **Học sinh A** | `studentA@chineselearner.vn` | `Student@123` | Đã được cấp quyền khóa **HSK 1** |
| **Học sinh B** | `studentB@chineselearner.vn` | `Student@123` | Chưa được cấp quyền khóa trả phí |

## Thanh toán PayOS

PayOS **không có môi trường sandbox**: mọi giao dịch qua PayOS là tiền thật.

- **Mặc định (`PAYMENT_GATEWAY=fake` trong `server/.env`):** dùng cổng giả lập.
  Trang thanh toán vẫn hiện mã QR (không quét được) và nút **"Giả lập: đã thanh toán"**.
  Nút này đi qua đúng đường xử lý webhook thật. Cổng giả lập tự chặn khi `NODE_ENV=production`.
- **Thử PayOS thật:** đặt `PAYMENT_GATEWAY=payos` và 3 key `PAYOS_*` (lấy ở my.payos.vn),
  rồi mua khoá demo "Giao tiếp du lịch Trung Quốc" giá 2.000 ₫ (`yarn db:demo`).
  Ở local, PayOS không gọi được webhook vào máy bạn. Trang thanh toán tự hỏi lại PayOS
  vài giây một lần nên vẫn mở khoá sau khi trả tiền.
- **Giá khoá học:** admin đặt ở `/admin/prices`. Để trống nghĩa là chưa mở bán.
  Đơn hàng xem ở `/admin/orders`.
- DB đang có dữ liệu thì chạy migration
  `server/db/migrations/20261122_1200_payments.sql` (chạy lại nhiều lần vẫn an toàn).

## Dữ liệu demo để thử giao diện (`yarn db:demo`)

Seed ở trên rất ít vì bộ test e2e dựa vào nó. Để có nhiều khoá học, bài học và
tài khoản mà bấm thử, nạp thêm dữ liệu demo **chồng lên seed** (chỉ trên DB local):

```bash
yarn db:reset && yarn db:seed && yarn db:demo
```

`yarn db:demo` chạy lại được bao nhiêu lần cũng được: nó xoá rồi tạo lại các dòng
`demo-*`, ghi tài liệu mẫu vào `server/uploads/documents/` và tạo video mẫu
(thẻ tiêu đề 4 giây, cần Chromium của Playwright) vào `server/uploads/videos/`.
Toàn bộ là nội dung bịa để thử giao diện, không có đánh giá hay số học viên. Giá trên các khoá là giá thử để test thanh toán.

Mật khẩu mọi tài khoản demo: `Demo@123`.

| Email | Vai trò | Dùng để thử |
|---|---|---|
| `gv.minh@demo.chineselearner.vn` | Giáo viên | HSK 2, HSK 3, du lịch, khoá nháp HSK 4 (chưa xuất bản) |
| `gv.ha@demo.chineselearner.vn` | Giáo viên | Khoá miễn phí (pinyin, ngữ pháp), tiếng Trung công sở |
| `hv01@demo.chineselearner.vn` | Học viên | Có 2 khoá: HSK 2, HSK 3 |
| `hv02@demo.chineselearner.vn` | Học viên | Có khoá công sở |
| `hv03@demo.chineselearner.vn` | Học viên | Có YCT 2 và Easy Steps 2 |
| `hv04@demo.chineselearner.vn` | Học viên | Bị thu hồi quyền HSK 2 (thấy bài bị khoá) |
| `hv05@demo.chineselearner.vn` | Học viên | Chưa có khoá nào (trạng thái trống) |
| `hv06@demo.chineselearner.vn` | Học viên | Tài khoản bị khoá: không đăng nhập được |

Ngoài ra Học sinh A được thêm HSK 2, và "YCT 3 – Sắp ra mắt" là khoá chưa có bài.

Xem thêm hướng dẫn chi tiết tại [tmp/HUONG-DAN-CHAY-LOCAL.md](./tmp/HUONG-DAN-CHAY-LOCAL.md) và [tmp/HUONG-DAN-DEPLOY-GCP.md](./tmp/HUONG-DAN-DEPLOY-GCP.md).
