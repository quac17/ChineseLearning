# Hướng dẫn Deploy lên Google Cloud Platform (GCP)

Tài liệu hướng dẫn triển khai hệ thống **Vân Kính** (`server` + `user-client` + PostgreSQL SQL thuần + kho lưu trữ video/tài liệu) lên **GCP** theo kiến trúc tối ưu chi phí, dễ gắn tên miền sau khi chốt domain.

> **Quy tắc an toàn cho database production**
>
> - Chỉ chạy **`server/db/sql/01_schema.sql`** (một lần, DB mới), **`02_master_data.sql`** (một lần) và các file **`server/db/migrations/*.sql` theo thứ tự tên file**.
> - **Không bao giờ** chạy `yarn db:reset`, `yarn db:seed`, `yarn db:demo` hay `yarn db:dump` trên DB production: `reset` xoá toàn bộ bảng, `seed`/`demo` nạp tài khoản demo có mật khẩu công khai trong README, `dump` ghi đè file SQL trong repo (repo công khai) bằng dữ liệu thật.
> - Không import `server/db/dumps/*.sql` hay `03_seed_data.sql` lên production.

---

## 1. Kiến trúc đề xuất trên GCP

| Thành phần | Dịch vụ GCP | Ghi chú |
|---|---|---|
| **Backend (`server`)** | **Cloud Run** | Build từ `server/Dockerfile`. Khi khởi động container chạy `yarn db:generate` (chỉ `CREATE TABLE IF NOT EXISTS` từ `01_schema.sql`, không xoá dữ liệu) rồi `node dist/main` |
| **Frontend (`user-client`)** | **Cloud Run** | Build từ `user-client/Dockerfile` (`output: 'standalone'`). Biến `NEXT_PUBLIC_*` được gắn **lúc build**, không phải lúc chạy |
| **Database** | **Cloud SQL (PostgreSQL 16)** | Schema + master data một lần, sau đó chỉ chạy migration (mục 4) |
| **Media (Video / DOC / PPT)** | **Cloud Storage (GCS)** | Mount bucket vào `/app/uploads` bằng Cloud Run Volume Mount (GCS FUSE). Bucket để **riêng tư**: video và tài liệu trả phí chỉ đi qua API có kiểm tra quyền |
| **Container Registry** | **Artifact Registry** | Lưu Docker image |
| **Bí mật** | **Secret Manager** | `JWT_SECRET`, mật khẩu DB, `PAYOS_*` |

---

## 2. Biến môi trường production

### Backend (`vankinh-server`), đặt lúc `gcloud run deploy`

| Biến | Giá trị production | Ghi chú |
|---|---|---|
| `NODE_ENV` | `production` | Đã đặt sẵn trong Dockerfile. Bật chặn cổng thanh toán giả lập |
| `PORT` | `4000` | Cloud Run truyền `PORT`; Dockerfile mặc định 4000, khớp `--port 4000` |
| `DATABASE_URL` | `postgresql://vankinh:<mật khẩu>@localhost/vankinh_db?host=/cloudsql/<INSTANCE_CONN>` | Ưu tiên hơn `POSTGRES_*`. Để trong Secret Manager |
| `JWT_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự | Secret Manager. Đổi secret = mọi người phải đăng nhập lại |
| `JWT_EXPIRES_IN` | `7d` | |
| `COOKIE_NAME` | `vankinh_token` | |
| `COOKIE_SECURE` | `true` | Bắt buộc trên HTTPS |
| `COOKIE_SAME_SITE` | `none` khi FE và BE khác tên miền (`*.run.app`); `lax` khi dùng chung tên miền cha (`vankinh.vn` + `api.vankinh.vn`) | `none` chỉ chạy được khi `COOKIE_SECURE=true` |
| `CORS_ORIGIN` | `https://<tên miền web học viên>` | Đúng origin, không có `/` cuối; nhiều origin cách nhau bằng dấu phẩy. **Không** dùng `*` (cookie đăng nhập cần `credentials`) |
| `APP_URL` | `https://<tên miền web học viên>` | PayOS đưa học viên về `${APP_URL}/checkout/<mã đơn>` |
| `PAYMENT_GATEWAY` | `payos` | `fake` bị chặn khi `NODE_ENV=production`: server không khởi động |
| `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` | key thật trong Kênh thanh toán trên my.payos.vn | Secret Manager. Thiếu một key thì server không khởi động. PayOS không có sandbox: mọi giao dịch là tiền thật |
| `UPLOAD_DIR` | `/app/uploads` | Trùng đường dẫn mount bucket |
| `MAX_VIDEO_SIZE_MB`, `MAX_DOC_SIZE_MB` | `500`, `50` | Tuỳ chỉnh nếu cần |

Không đặt `FAKE_PAYMENT_CHECKSUM_KEY` ở production.

### Frontend (`vankinh-client`), truyền bằng `--build-arg` lúc build image

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<tên miền API>/api` |
| `NEXT_PUBLIC_SUPPORT_CONTACT` | kênh hỗ trợ thật (để trống thì ẩn) |
| `NEXT_PUBLIC_REFUND_POLICY` | một câu chính sách hoàn tiền thật (để trống thì ẩn) |

Đổi một biến `NEXT_PUBLIC_*` thì phải **build lại** image frontend.

---

## 3. Chuẩn bị GCP CLI

```bash
gcloud auth login

export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="asia-southeast1"   # Singapore - gần Việt Nam nhất

gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com
```

---

## 4. Tạo Artifact Registry, Cloud SQL, Cloud Storage, Secret Manager

```bash
# 1. Artifact Registry
gcloud artifacts repositories create vankinh-repo \
  --repository-format=docker \
  --location=$REGION

# 2. Cloud SQL PostgreSQL 16
gcloud sql instances create vankinh-pg \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION

gcloud sql databases create vankinh_db --instance=vankinh-pg
gcloud sql users create vankinh \
  --instance=vankinh-pg \
  --password="CHANGE_THIS_STRONG_PASSWORD"

# 3. Cloud Storage bucket (riêng tư) lưu video & tài liệu
export BUCKET_NAME="${PROJECT_ID}-vankinh-uploads"
gcloud storage buckets create gs://${BUCKET_NAME} --location=$REGION \
  --uniform-bucket-level-access --public-access-prevention

# 4. Secret Manager (giá trị thật nhập từ bàn phím, không ghi vào file trong repo)
printf '%s' "CHANGE_TO_LONG_RANDOM_SECRET" | gcloud secrets create vankinh-jwt-secret --data-file=-
printf '%s' "postgresql://vankinh:CHANGE_THIS_STRONG_PASSWORD@localhost/vankinh_db?host=/cloudsql/INSTANCE_CONN" \
  | gcloud secrets create vankinh-database-url --data-file=-
printf '%s' "PAYOS_CLIENT_ID_THAT" | gcloud secrets create vankinh-payos-client-id --data-file=-
printf '%s' "PAYOS_API_KEY_THAT" | gcloud secrets create vankinh-payos-api-key --data-file=-
printf '%s' "PAYOS_CHECKSUM_KEY_THAT" | gcloud secrets create vankinh-payos-checksum-key --data-file=-
```

Cấp quyền `roles/secretmanager.secretAccessor` cho service account của Cloud Run để đọc các secret này.

### Nạp schema, master data và migration

Chạy từ máy có `psql`, nối vào Cloud SQL qua Cloud SQL Auth Proxy (`cloud-sql-proxy <INSTANCE_CONN> --port 5434`), với `PROD_URL=postgresql://vankinh:<mật khẩu>@localhost:5434/vankinh_db`:

```bash
# Lần đầu (DB trống)
psql "$PROD_URL" -v ON_ERROR_STOP=1 -f server/db/sql/01_schema.sql
psql "$PROD_URL" -v ON_ERROR_STOP=1 -f server/db/sql/02_master_data.sql

# Mỗi lần deploy: mọi migration, theo thứ tự tên file (YYYYMMDD_HHMM_*.sql)
for f in $(ls server/db/migrations/*.sql | sort); do
  echo "→ $f"
  psql "$PROD_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

- Mỗi migration idempotent (`IF NOT EXISTS`, có `BEGIN/COMMIT`), chạy lại không hỏng dữ liệu. Vẫn chạy đúng thứ tự vì file sau có thể dựa vào bảng của file trước.
- Chạy migration **trước** khi deploy bản server mới cần cột/bảng mới.
- Sao lưu trước: `gcloud sql backups create --instance=vankinh-pg`.
- `02_master_data.sql` tạo tài khoản quản trị gốc `admin@vankinh.vn` với mật khẩu mặc định có trong repo công khai. **Đổi mật khẩu tài khoản này ngay sau lần nạp đầu** (đăng nhập rồi đổi ở trang Tài khoản), hoặc đổi email/mật khẩu trước khi mở web.

---

## 5. Build & Deploy Backend (`server/`) lên Cloud Run

```bash
gcloud builds submit ./server \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-server:latest

export INSTANCE_CONN=$(gcloud sql instances describe vankinh-pg --format="value(connectionName)")
export WEB_URL="https://vankinh-client-xxxxxx-as.a.run.app"   # cập nhật sau khi có frontend / tên miền

gcloud run deploy vankinh-server \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-server:latest \
  --region $REGION \
  --execution-environment gen2 \
  --allow-unauthenticated \
  --port 4000 \
  --memory 1Gi \
  --add-cloudsql-instances ${INSTANCE_CONN} \
  --add-volume name=uploads,type=cloud-storage,bucket=${BUCKET_NAME} \
  --add-volume-mount volume=uploads,mount-path=/app/uploads \
  --set-env-vars "NODE_ENV=production,UPLOAD_DIR=/app/uploads,JWT_EXPIRES_IN=7d,COOKIE_NAME=vankinh_token,COOKIE_SECURE=true,COOKIE_SAME_SITE=none,CORS_ORIGIN=${WEB_URL},APP_URL=${WEB_URL},PAYMENT_GATEWAY=payos" \
  --set-secrets "JWT_SECRET=vankinh-jwt-secret:latest,DATABASE_URL=vankinh-database-url:latest,PAYOS_CLIENT_ID=vankinh-payos-client-id:latest,PAYOS_API_KEY=vankinh-payos-api-key:latest,PAYOS_CHECKSUM_KEY=vankinh-payos-checksum-key:latest"
```

Kiểm tra: `curl https://<URL backend>/api/health` trả về OK.

### Webhook PayOS

Trong my.payos.vn → Kênh thanh toán → Webhook, đặt URL:

```
https://<tên miền API>/api/payments/webhook/payos
```

Server kiểm tra chữ ký bằng `PAYOS_CHECKSUM_KEY` và xử lý trùng lặp an toàn (idempotent).

---

## 6. Build & Deploy Frontend (`user-client/`) lên Cloud Run

```bash
export BACKEND_URL="https://vankinh-server-xxxxxx-as.a.run.app"

gcloud builds submit ./user-client \
  --config /dev/stdin <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_API_URL=${BACKEND_URL}/api'
      - '--build-arg'
      - 'NEXT_PUBLIC_SUPPORT_CONTACT=Zalo 09xx xxx xxx'
      - '--build-arg'
      - 'NEXT_PUBLIC_REFUND_POLICY=Câu chính sách hoàn tiền thật của bạn'
      - '-t'
      - '${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-client:latest'
      - '.'
images:
  - '${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-client:latest'
EOF

gcloud run deploy vankinh-client \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-client:latest \
  --region $REGION \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi
```

Sau khi có URL Frontend, cập nhật lại `CORS_ORIGIN` và `APP_URL` trên `vankinh-server`:

```bash
gcloud run services update vankinh-server \
  --region $REGION \
  --update-env-vars "CORS_ORIGIN=https://vankinh-client-xxxxxx-as.a.run.app,APP_URL=https://vankinh-client-xxxxxx-as.a.run.app"
```

---

## 7. Gắn tên miền sau khi quyết định Domain

1. Vào **Cloud Run → Manage Custom Domains**:
   - Map `vankinh.vn` → `vankinh-client`
   - Map `api.vankinh.vn` → `vankinh-server`
2. Trỏ DNS theo hướng dẫn GCP để nhận SSL tự động.
3. Khi đã dùng chung tên miền cha (`vankinh.vn` và `api.vankinh.vn`):
   - Server: `CORS_ORIGIN=https://vankinh.vn`, `APP_URL=https://vankinh.vn`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`.
   - Build lại `user-client` với `NEXT_PUBLIC_API_URL=https://api.vankinh.vn/api`.
   - Cập nhật URL webhook PayOS thành `https://api.vankinh.vn/api/payments/webhook/payos`.

---

## 8. Kiểm tra sau khi deploy

- [ ] `GET /api/health` OK; log server không có lỗi thiếu key PayOS hay "cổng thanh toán giả lập".
- [ ] Đã đổi mật khẩu `admin@vankinh.vn`.
- [ ] Đăng ký tài khoản học viên mới, đăng nhập, tải lại trang vẫn còn đăng nhập (cookie `Secure`).
- [ ] Mua một khoá bằng QR PayOS (tiền thật, số tiền nhỏ), webhook về, khoá mở, xem được video.
- [ ] Tải một tài liệu của khoá đã mua; tài khoản chưa mua bị chặn (403).
- [ ] Web cài được lên màn hình chính (Android Chrome, iOS Safari).

## 9. Ghi chú khi rà Dockerfile

- `server/Dockerfile`: build nhiều tầng, chạy `NODE_ENV=production`. Ảnh chạy giữ toàn bộ `node_modules` (kể cả devDependencies) vì `yarn db:generate` cần `ts-node` lúc khởi động. `db:generate` chỉ tạo bảng còn thiếu, **không** chạy migration: migration vẫn chạy tay theo mục 4.
- `server/.dockerignore` bỏ `db/dumps` (bản dump có thể chứa dữ liệu thật) và `dist-e2e` khỏi ảnh.
- `user-client/Dockerfile`: dùng `output: 'standalone'`, chép `public/` (logo, icon PWA, ảnh; trước đây bị thiếu nên các file này trả 404) và `.next/static` vào ảnh chạy. Ba biến `NEXT_PUBLIC_*` là `ARG` lúc build.