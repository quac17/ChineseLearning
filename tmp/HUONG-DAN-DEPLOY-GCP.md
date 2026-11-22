# Hướng dẫn deploy Vân Kính lên Google Cloud Platform (GCP)

Làm lần lượt từ mục 1 đến mục 12. Mỗi lệnh dưới đây chạy trên máy của bạn (đã cài
`gcloud`, `psql` và Docker hoặc dùng Cloud Build). Chỗ nào viết `CHANGE_...` hoặc
`<...>` là giá trị bạn tự điền; **không ghi giá trị thật vào file nào trong repo**
(repo công khai).

> **Quy tắc an toàn cho database production**
>
> - Chỉ chạy **`server/db/sql/01_schema.sql`** (một lần, DB trống), **`02_master_data.sql`**
>   (một lần) và các file **`server/db/migrations/*.sql` theo thứ tự tên file**.
> - **Không bao giờ** chạy `yarn db:reset`, `yarn db:seed`, `yarn db:demo` hay `yarn db:dump`
>   trên DB production: `reset` xoá toàn bộ bảng, `seed`/`demo` nạp tài khoản demo có mật khẩu
>   công khai trong README, `dump` ghi đè file SQL trong repo bằng dữ liệu thật.
> - Không import `server/db/dumps/*.sql` hay `03_seed_data.sql` / `04_demo_data.sql` lên production.
> - Server production **không tự tạo bảng** khi khởi động: schema và migration luôn chạy tay (mục 6).

---

## 1. Kiến trúc

| Thành phần | Dịch vụ GCP | Ghi chú |
|---|---|---|
| Backend (`server`) | Cloud Run `vankinh-server` | Image từ `server/Dockerfile`, chạy `node dist/main` bằng user `node` |
| Web học viên (`user-client`) | Cloud Run `vankinh-client` | Image từ `user-client/Dockerfile` (`output: 'standalone'`). Biến `NEXT_PUBLIC_*` gắn **lúc build** |
| Database | Cloud SQL PostgreSQL 16 | Nối qua socket `/cloudsql/<INSTANCE_CONN>` |
| Video, tài liệu, phụ đề, ảnh bìa | Cloud Storage, bucket **riêng tư** | `STORAGE_BACKEND=gcs`. Video tải thẳng từ trình duyệt giáo viên lên bucket bằng signed URL; học viên chỉ nhận link có thời hạn (15 phút) **sau khi** server kiểm tra quyền xem |
| Docker image | Artifact Registry | |
| Bí mật | Secret Manager | `JWT_SECRET`, `DATABASE_URL`, `PAYOS_*`, `SMTP_PASS` |

Cloud Run giới hạn thân request 32 MB, nên video lớn không đi qua server mà đi thẳng lên
bucket. Tài liệu vẫn tải qua server: giữ `MAX_DOC_SIZE_MB=30`.

---

## 2. Biến môi trường production

Khi `NODE_ENV=production`, server **không khởi động** nếu thiếu hoặc sai các biến được đánh dấu
"bắt buộc" (log Cloud Run liệt kê đủ mọi lỗi một lần). Các kiểm tra nằm ở
`server/src/config/production-env.ts`, cùng với kiểm tra key PayOS (`PaymentsModule`) và
`GCS_BUCKET` (`StorageService`).

### Backend (`vankinh-server`)

| Biến | Giá trị production | Bắt buộc | Ghi chú |
|---|---|---|---|
| `NODE_ENV` | `production` | có | Đã đặt sẵn trong Dockerfile |
| `PORT` | do Cloud Run đặt (8080) | | Không cần `--port`; server đọc `PORT` |
| `DATABASE_URL` | `postgresql://vankinh:<mật khẩu>@localhost/vankinh_db?host=/cloudsql/<INSTANCE_CONN>` | có | Secret Manager |
| `JWT_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự | có | Secret Manager. Giá trị của `.env.example` bị từ chối. Đổi secret = mọi người đăng nhập lại |
| `JWT_EXPIRES_IN` | `7d` | | |
| `COOKIE_NAME` | `vankinh_token` | | |
| `COOKIE_SECURE` | `true` | có | Cookie đăng nhập chỉ đi qua HTTPS |
| `COOKIE_SAME_SITE` | `none` khi web và API khác tên miền (hai URL `*.run.app`); `lax` khi chung tên miền cha (`vankinh.vn` + `api.vankinh.vn`) | có (`lax`/`strict`/`none`) | `none` chỉ chạy khi `COOKIE_SECURE=true` |
| `CORS_ORIGIN` | `https://<tên miền web>` | có | Đúng origin https, không có `/` cuối, nhiều origin cách nhau dấu phẩy. Không dùng `*` |
| `APP_URL` | `https://<tên miền web>` | có | PayOS đưa học viên về `${APP_URL}/checkout/<mã đơn>`; link trong email cũng trỏ về đây |
| `PAYMENT_GATEWAY` | `payos` | có | `fake` bị chặn ở production |
| `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` | key thật từ my.payos.vn | có | Secret Manager. PayOS không có sandbox: mọi giao dịch là tiền thật |
| `STORAGE_BACKEND` | `gcs` | nên có | Thiếu thì server chỉ cảnh báo, nhưng file sẽ mất mỗi lần Cloud Run khởi động lại |
| `GCS_BUCKET` | tên bucket ở mục 5 | có khi `gcs` | |
| `GCS_SIGNED_URL_TTL_MIN` | `15` | | Thời hạn link xem video / tải tài liệu |
| `GCS_UPLOAD_URL_TTL_MIN` | `30` | | Thời hạn link tải video lên của giáo viên |
| `UPLOAD_DIR` | `/tmp/vankinh-uploads` | | Đặt sẵn trong Dockerfile; chỉ là thư mục tạm cho tài liệu/phụ đề trước khi lên bucket |
| `MAX_VIDEO_SIZE_MB` | `2000` (tuỳ bạn) | | Video đi thẳng lên bucket nên có thể lớn hơn 32 MB |
| `MAX_DOC_SIZE_MB` | `30` | | Phải dưới 32 MB (giới hạn Cloud Run) |
| `MAIL_TRANSPORT` | `smtp` | nên có | `console` bị chặn ở production (PR #31) |
| `MAIL_FROM` | `Vân Kính <no-reply@<tên miền>>` | | Địa chỉ đã xác minh ở nhà cung cấp email |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` | theo nhà cung cấp (#16) | | Cổng 465 = TLS, cổng khác = STARTTLS |
| `SMTP_PASS` | mật khẩu / API key SMTP | | Secret Manager |
| `MAIL_DEV_OUTBOX` | `false` | | **Không bao giờ** bật ở production |
| `TRUST_PROXY` | `1` | | Cloud Run có một proxy phía trước: lấy đúng IP để giới hạn số lần quên mật khẩu |

Không đặt `FAKE_PAYMENT_CHECKSUM_KEY` và `GOOGLE_APPLICATION_CREDENTIALS` trên Cloud Run
(server dùng service account của dịch vụ, không cần file key).

### Web học viên (`vankinh-client`), truyền bằng `--build-arg` lúc build image

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<tên miền API>/api` |
| `NEXT_PUBLIC_SUPPORT_CONTACT` | kênh hỗ trợ thật (để trống thì ẩn) |
| `NEXT_PUBLIC_REFUND_POLICY` | một câu chính sách hoàn tiền thật (để trống thì ẩn) |

Đổi một biến `NEXT_PUBLIC_*` thì phải **build lại** image web.

---

## 3. Chuẩn bị `gcloud`

```bash
gcloud auth login

export PROJECT_ID="CHANGE_YOUR_PROJECT_ID"
export REGION="asia-southeast1"   # Singapore, gần Việt Nam nhất

gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com

gcloud artifacts repositories create vankinh-repo \
  --repository-format=docker --location=$REGION
```

`iamcredentials.googleapis.com` cần cho việc ký signed URL bằng service account (không có file key).

---

## 4. Cloud SQL (PostgreSQL 16)

```bash
gcloud sql instances create vankinh-pg \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION \
  --backup-start-time=18:00        # 01:00 giờ Việt Nam

gcloud sql databases create vankinh_db --instance=vankinh-pg
gcloud sql users create vankinh --instance=vankinh-pg --password="CHANGE_STRONG_DB_PASSWORD"

export INSTANCE_CONN=$(gcloud sql instances describe vankinh-pg --format="value(connectionName)")
echo $INSTANCE_CONN   # dạng PROJECT:REGION:vankinh-pg
```

---

## 5. Service account, bucket Cloud Storage và quyền

### 5.1 Service account cho backend

```bash
export SA="vankinh-server@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create vankinh-server --display-name="Vân Kính server"

# Nối Cloud SQL
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" --role="roles/cloudsql.client"

# Ký signed URL bằng chính nó (không cần file key JSON)
gcloud iam service-accounts add-iam-policy-binding $SA \
  --member="serviceAccount:${SA}" --role="roles/iam.serviceAccountTokenCreator"
```

### 5.2 Bucket riêng tư

```bash
export BUCKET_NAME="${PROJECT_ID}-vankinh-media"
gcloud storage buckets create gs://${BUCKET_NAME} \
  --location=$REGION \
  --uniform-bucket-level-access \
  --public-access-prevention

# Server đọc, ghi, xoá file trong đúng bucket này (không cấp cho cả project)
gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} \
  --member="serviceAccount:${SA}" --role="roles/storage.objectAdmin"
```

**Không** cấp `allUsers` / `allAuthenticatedUsers` cho bucket. Mọi video và tài liệu chỉ ra
ngoài qua link có chữ ký, do server tạo sau khi kiểm tra quyền xem.

### 5.3 CORS cho việc giáo viên tải video thẳng lên bucket

Trình duyệt giáo viên gửi `PUT` tới `storage.googleapis.com`, nên bucket phải cho phép origin
của web. Tạo file `cors.json` **ngoài repo** (ví dụ trong `/tmp`):

```json
[
  {
    "origin": ["https://<tên miền web>"],
    "method": ["PUT"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

```bash
gcloud storage buckets update gs://${BUCKET_NAME} --cors-file=/tmp/cors.json
```

Khi đổi tên miền web (mục 10), sửa `origin` và chạy lại lệnh này. Xem video và tải tài liệu
không cần CORS.

---

## 6. Secret Manager

Nhập giá trị thật từ bàn phím (lệnh `read -s` không hiện ra màn hình và không lưu vào lịch sử):

```bash
new_secret() { read -rsp "$1: " v; echo; printf '%s' "$v" | gcloud secrets create "$1" --data-file=-; }

new_secret vankinh-jwt-secret           # ví dụ tạo bằng: openssl rand -base64 48
new_secret vankinh-database-url         # postgresql://vankinh:<mật khẩu>@localhost/vankinh_db?host=/cloudsql/<INSTANCE_CONN>
new_secret vankinh-payos-client-id
new_secret vankinh-payos-api-key
new_secret vankinh-payos-checksum-key
new_secret vankinh-smtp-pass

for s in vankinh-jwt-secret vankinh-database-url vankinh-payos-client-id \
         vankinh-payos-api-key vankinh-payos-checksum-key vankinh-smtp-pass; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor"
done
```

Đổi một secret: `printf '%s' "<giá trị mới>" | gcloud secrets versions add <tên> --data-file=-`,
rồi deploy lại backend (mục 8) để revision mới đọc bản `latest`.

---

## 7. Nạp schema, master data và migration

Chạy từ máy của bạn qua Cloud SQL Auth Proxy, ở thư mục gốc repo:

```bash
cloud-sql-proxy $INSTANCE_CONN --port 5434 &     # để chạy nền
read -rsp "Mật khẩu DB: " DBPASS; echo
export PROD_URL="postgresql://vankinh:${DBPASS}@localhost:5434/vankinh_db"

# Sao lưu trước mỗi lần thay đổi (bỏ qua ở lần đầu, DB còn trống)
gcloud sql backups create --instance=vankinh-pg

# CHỈ lần đầu (DB trống)
psql "$PROD_URL" -v ON_ERROR_STOP=1 -f server/db/sql/01_schema.sql
psql "$PROD_URL" -v ON_ERROR_STOP=1 -f server/db/sql/02_master_data.sql

# Lần đầu và MỖI lần deploy: mọi migration, theo thứ tự tên file (YYYYMMDD_HHMM_*.sql)
for f in $(ls server/db/migrations/*.sql | sort); do
  echo "→ $f"
  psql "$PROD_URL" -v ON_ERROR_STOP=1 -f "$f" || { echo "DỪNG: lỗi ở $f"; break; }
done
```

- Mỗi migration idempotent (`IF NOT EXISTS`, có `BEGIN/COMMIT`), chạy lại không hỏng dữ liệu.
  Vẫn chạy đủ, đúng thứ tự, vì file sau dựa vào bảng của file trước.
- Chạy migration **trước** khi deploy bản server mới cần cột/bảng mới.
- **Không** chạy `yarn db:reset`, `db:seed`, `db:demo`, `db:dump` với `PROD_URL`.
- `02_master_data.sql` tạo tài khoản quản trị `admin@vankinh.vn` với **mật khẩu mặc định ghi
  công khai trong README**. Đổi mật khẩu ngay ở mục 11, bước đầu tiên.

---

## 8. Build và deploy backend

```bash
gcloud builds submit ./server \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-server:latest

export WEB_URL="https://vankinh-client-CHANGE.a.run.app"   # tạm; sửa sau mục 9 / mục 10

gcloud run deploy vankinh-server \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-server:latest \
  --region $REGION \
  --service-account $SA \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 3600 \
  --add-cloudsql-instances ${INSTANCE_CONN} \
  --set-env-vars "^@^NODE_ENV=production@JWT_EXPIRES_IN=7d@COOKIE_NAME=vankinh_token@COOKIE_SECURE=true@COOKIE_SAME_SITE=none@CORS_ORIGIN=${WEB_URL}@APP_URL=${WEB_URL}@PAYMENT_GATEWAY=payos@STORAGE_BACKEND=gcs@GCS_BUCKET=${BUCKET_NAME}@GCS_SIGNED_URL_TTL_MIN=15@GCS_UPLOAD_URL_TTL_MIN=30@MAX_VIDEO_SIZE_MB=2000@MAX_DOC_SIZE_MB=30@MAIL_TRANSPORT=smtp@MAIL_FROM=Vân Kính <no-reply@CHANGE_DOMAIN>@SMTP_HOST=CHANGE_SMTP_HOST@SMTP_PORT=465@SMTP_USER=CHANGE_SMTP_USER@MAIL_DEV_OUTBOX=false@TRUST_PROXY=1" \
  --set-secrets "JWT_SECRET=vankinh-jwt-secret:latest,DATABASE_URL=vankinh-database-url:latest,PAYOS_CLIENT_ID=vankinh-payos-client-id:latest,PAYOS_API_KEY=vankinh-payos-api-key:latest,PAYOS_CHECKSUM_KEY=vankinh-payos-checksum-key:latest,SMTP_PASS=vankinh-smtp-pass:latest"

export API_URL=$(gcloud run services describe vankinh-server --format="value(status.url)")
curl -fsS ${API_URL}/api/health && echo " ← backend OK"
```

- `^@^` đổi ký tự phân cách sang `@` vì `MAIL_FROM` có dấu phẩy/khoảng trắng.
- Nếu revision không lên: **Cloud Run → vankinh-server → Logs**, tìm dòng
  `Production configuration is incomplete` (liệt kê mọi biến thiếu), `PAYMENT_GATEWAY=payos cần ...`
  hoặc `STORAGE_BACKEND=gcs needs GCS_BUCKET`.

---

## 9. Build và deploy web học viên

```bash
cat > /tmp/cloudbuild-client.yaml <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_API_URL=${API_URL}/api'
      - '--build-arg'
      - 'NEXT_PUBLIC_SUPPORT_CONTACT=CHANGE: Zalo 09xx xxx xxx'
      - '--build-arg'
      - 'NEXT_PUBLIC_REFUND_POLICY=CHANGE: câu chính sách hoàn tiền thật'
      - '-t'
      - '${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-client:latest'
      - '.'
images:
  - '${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-client:latest'
EOF
gcloud builds submit ./user-client --config /tmp/cloudbuild-client.yaml

gcloud run deploy vankinh-client \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-client:latest \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi

export WEB_URL=$(gcloud run services describe vankinh-client --format="value(status.url)")

# Báo cho backend biết địa chỉ web thật
gcloud run services update vankinh-server --region $REGION \
  --update-env-vars "CORS_ORIGIN=${WEB_URL},APP_URL=${WEB_URL}"
```

Sửa `origin` trong `cors.json` thành `${WEB_URL}` và chạy lại lệnh ở mục 5.3.

### 9.1 Chuyển file cũ lên bucket (chỉ khi đã có file trong `server/uploads`)

Nếu đã có video/tài liệu tải lên ở một máy chạy `STORAGE_BACKEND=local` và DB đó chính là DB
production, chạy ở máy đang giữ thư mục `server/uploads`:

```bash
gcloud auth application-default login      # không cần file key
cd server
GCS_BUCKET=${BUCKET_NAME} DATABASE_URL="$PROD_URL" yarn storage:to-gcs --dry-run   # xem trước
GCS_BUCKET=${BUCKET_NAME} DATABASE_URL="$PROD_URL" yarn storage:to-gcs             # chép thật
```

Script giữ nguyên tên file (`videos/...`, `documents/...`), nên DB không phải sửa. Chạy lại bao
nhiêu lần cũng được: file đã có trên bucket với cùng dung lượng sẽ được bỏ qua. Kết quả phải là
`missing locally 0`. Script không xoá gì.

---

## 10. Webhook PayOS, tên miền và HTTPS

### 10.1 Webhook PayOS

my.payos.vn → **Kênh thanh toán** → **Webhook**:

```
https://<tên miền API>/api/payments/webhook/payos
```

Server kiểm tra chữ ký bằng `PAYOS_CHECKSUM_KEY` và xử lý trùng lặp an toàn. Mỗi lần đổi tên
miền API thì đổi lại URL này.

### 10.2 Tên miền riêng

1. Cloud Run → **Manage custom domains** (hoặc `gcloud beta run domain-mappings create`):
   - `vankinh.vn` → `vankinh-client`
   - `api.vankinh.vn` → `vankinh-server`
2. Thêm bản ghi DNS theo hướng dẫn GCP; chờ chứng chỉ HTTPS tự cấp (có thể mất tới vài giờ).
3. Khi cả hai chạy dưới chung tên miền cha:

```bash
gcloud run services update vankinh-server --region $REGION \
  --update-env-vars "CORS_ORIGIN=https://vankinh.vn,APP_URL=https://vankinh.vn,COOKIE_SECURE=true,COOKIE_SAME_SITE=lax"
```

4. Build lại web (mục 9) với `NEXT_PUBLIC_API_URL=https://api.vankinh.vn/api`.
5. Sửa `origin` trong `cors.json` của bucket thành `https://vankinh.vn` (mục 5.3).
6. Đổi URL webhook PayOS thành `https://api.vankinh.vn/api/payments/webhook/payos`.

---

## 11. Checklist sau khi deploy

Làm theo thứ tự; dừng lại ở bước đầu tiên bị lỗi.

- [ ] **Đổi mật khẩu `admin@vankinh.vn` ngay**: mật khẩu seed nằm công khai trong README.
      Đăng nhập trên web → **Tài khoản** → đổi mật khẩu (hoặc đổi luôn email quản trị).
- [ ] `curl https://<API>/api/health` trả OK. Log server không có `Production configuration is incomplete`,
      không có cảnh báo `STORAGE_BACKEND is not "gcs"`.
- [ ] Đăng ký một học viên mới, đăng nhập, tải lại trang vẫn còn đăng nhập (cookie `Secure`).
- [ ] Quên mật khẩu: nhận được email, đường dẫn mở đúng `https://<tên miền web>/...`.
- [ ] Giáo viên tải lên một video > 40 MB: DevTools thấy `PUT https://storage.googleapis.com/...`
      chạy tới 100%, rồi `POST /api/lessons/upload/confirm` 201. Tải một tài liệu và một ảnh bìa.
- [ ] Học viên **chưa** mua: `curl -i https://<API>/api/lessons/<id bài trả phí>/stream` → `403`.
- [ ] Mua một khoá bằng QR PayOS (tiền thật, số tiền nhỏ, ví dụ 2.000 ₫): webhook về, khoá mở.
- [ ] Học viên đã mua: video phát được, tua được; trong DevTools, `/stream` trả `302` sang
      `storage.googleapis.com`. Dừng video 16 phút rồi bấm phát: video chạy tiếp.
- [ ] Tải một tài liệu của khoá đã mua: file lưu đúng tên tiếng Việt. Học viên chưa mua → `403`.
- [ ] Mở thẳng một link signed URL sau hơn 15 phút: Google trả lỗi hết hạn.
- [ ] `gcloud storage buckets describe gs://${BUCKET_NAME} --format="value(iamConfiguration.publicAccessPrevention)"` → `enforced`.
- [ ] Web cài được lên màn hình chính (Android Chrome, iOS Safari).
- [ ] Đã bật sao lưu Cloud SQL (mục 4) và thử `gcloud sql backups list --instance=vankinh-pg`.

---

## 12. Ghi chú về Dockerfile

- `server/Dockerfile`: ba tầng. Tầng build có đủ dependencies, tầng `deps` chỉ cài dependencies
  production, ảnh chạy chỉ có `dist/` + `node_modules` production và chạy bằng user `node`
  (không phải root). Server **không** chạy `db:generate` lúc khởi động: schema và migration chạy
  tay theo mục 7. Cổng lấy từ `PORT` (Cloud Run đặt 8080).
- `server/.dockerignore` bỏ `db/` (dump có thể chứa dữ liệu thật), `uploads/`, `.env*` và mọi file
  key JSON khỏi ảnh.
- `user-client/Dockerfile`: `output: 'standalone'`, chép `public/` và `.next/static`, chạy bằng user
  `node`, cổng lấy từ `PORT`. Ba biến `NEXT_PUBLIC_*` là `ARG` lúc build.
- Thử ở máy: `docker build -t vankinh-server ./server` và
  `docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000/api -t vankinh-client ./user-client`.
