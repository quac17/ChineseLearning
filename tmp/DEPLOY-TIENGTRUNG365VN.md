# Checklist Deploy `tiengtrung365vn.com` (Cloudflare + GCP Cloud Run)

Kiến trúc tên miền cho **tiengtrung365vn.com**:
- **Frontend (`chinese-learner-client`)**: `https://tiengtrung365vn.com` (và `https://www.tiengtrung365vn.com`)
- **Backend API (`chinese-learner-server`)**: `https://api.tiengtrung365vn.com`
- **Cookie Auth**: chung tên miền cha `*.tiengtrung365vn.com` → dùng `COOKIE_SAME_SITE=lax` + `COOKIE_SECURE=true` (ổn định 100% trên Safari/iPhone).

---

## Bước 1: Điền biến môi trường local `.env.prd` (không commit)

```bash
yarn env_prd
```
Mở file `.env.prd` vừa tạo và điền `GCP_PROJECT_ID`, mật khẩu DB, `JWT_SECRET`, key PayOS và SMTP của bạn.

---

## Bước 2: Khởi tạo hạ tầng trên GCP Project trống

Chạy các lệnh trong [HUONG-DAN-DEPLOY-GCP.md](./HUONG-DAN-DEPLOY-GCP.md) mục 3 → mục 7 với `PROJECT_ID` của bạn (`REGION="asia-southeast1"`):
1. Bật APIs & tạo Artifact Registry `chinese-learner-repo`.
2. Tạo Cloud SQL PostgreSQL 16 (`chinese-learner-pg`), DB `chinese_learner_db`, user `chinese_learner`.
3. Tạo Service Account `chinese-learner-server` + bucket riêng tư `${PROJECT_ID}-chinese-learner-media`.
4. Set CORS cho bucket với origin `https://tiengtrung365vn.com`:
   ```json
   [
     {
       "origin": ["https://tiengtrung365vn.com", "https://www.tiengtrung365vn.com"],
       "method": ["PUT"],
       "responseHeader": ["Content-Type"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
5. Nạp 7 secrets vào Secret Manager (`chinese-learner-jwt-secret`, `chinese-learner-database-url`, `chinese-learner-payos-client-id`, `chinese-learner-payos-api-key`, `chinese-learner-payos-checksum-key`, `chinese-learner-smtp-pass`, `chinese-learner-reminder-cron-secret`).
6. Chạy `01_schema.sql`, `02_master_data.sql` và toàn bộ `server/db/migrations/*.sql` qua `cloud-sql-proxy`.

---

## Bước 3: Cấu hình GitHub Actions để tự động Deploy khi merge `main`

Workflow đã được tạo sẵn tại `.github/workflows/deploy-gcp.yml`. Vào **GitHub Repo → Settings → Secrets and variables → Actions**:

### Tab `Variables`
Chỉ bắt buộc đặt **`GCP_PROJECT_ID`** (các giá trị dưới đã có mặc định cho `tiengtrung365vn.com`, chỉ cần thêm nếu muốn ghi đè):
- `GCP_PROJECT_ID`: `<project-id-cua-ban>` *(bắt buộc)*
- `MAIL_FROM`: `Tiếng Trung 365 <no-reply@tiengtrung365vn.com>`
- `SMTP_HOST`: `smtp.resend.com` *(hoặc `smtp.gmail.com` / `smtp.sendgrid.net`)*
- `SMTP_PORT`: `465`
- `SMTP_USER`: `resend`
- `NEXT_PUBLIC_SUPPORT_CONTACT`: *(tuỳ chọn, ví dụ `Zalo 09xx xxx xxx`)*
- `NEXT_PUBLIC_REFUND_POLICY`: *(tuỳ chọn)*

### Tab `Secrets`
- `GCP_SA_KEY`: JSON key của service account `github-deployer` (có quyền `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`).

---

## Bước 4: Map tên miền `tiengtrung365vn.com` trên Cloudflare → Cloud Run

1. Vào **GCP Console → Cloud Run → Manage Custom Domains → Add Mapping**:
   - Xác minh tên miền `tiengtrung365vn.com` bằng bản ghi `TXT` trên Cloudflare DNS.
   - Map `tiengtrung365vn.com` → `chinese-learner-client` (Cloud Run cấp danh sách bản ghi `A` và `AAAA`).
   - Map `www.tiengtrung365vn.com` → `chinese-learner-client` (Cloud Run cấp `CNAME` `ghs.googlehosted.com.`).
   - Map `api.tiengtrung365vn.com` → `chinese-learner-server` (Cloud Run cấp `CNAME` `ghs.googlehosted.com.`).
2. Vào **Cloudflare Dashboard → `tiengtrung365vn.com` → DNS → Records**, thêm đầy đủ các bản ghi trên.
   - **Quan trọng:** Trong lúc Cloud Run đang cấp chứng chỉ SSL (15–30 phút đầu), đặt **Proxy status = DNS only (đám mây xám)**.
   - Sau khi Cloud Run báo **Active (tích xanh)** cả 3 domain, có thể giữ **DNS only** hoặc bật **Proxied (đám mây cam)** kèm chế độ **SSL/TLS = Full (strict)** trên Cloudflare.

---

## Bước 5: PayOS Webhook & Cloud Scheduler

1. Trên `my.payos.vn` → **Kênh thanh toán → Webhook**:
   ```text
   https://api.tiengtrung365vn.com/api/payments/webhook/payos
   ```
2. Tạo job Cloud Scheduler (19:00 hàng ngày giờ VN) trỏ tới:
   ```text
   https://api.tiengtrung365vn.com/api/reminders/run
   ```
3. Đăng nhập lần đầu vào `https://tiengtrung365vn.com/login` bằng `admin@chineselearner.vn` và **đổi mật khẩu ngay** tại `/account`.
