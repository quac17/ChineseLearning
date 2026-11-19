# Hướng dẫn Deploy lên Google Cloud Platform (GCP)

Tài liệu hướng dẫn triển khai hệ thống **Vân Kính** (`server` + `user-client` + PostgreSQL SQL thuần + kho lưu trữ video/tài liệu) lên **GCP** theo kiến trúc tối ưu chi phí, dễ gắn tên miền sau khi chốt domain.

---

## 1. Kiến trúc đề xuất trên GCP

| Thành phần | Dịch vụ GCP | Ghi chú |
|---|---|---|
| **Backend (`server`)** | **Cloud Run** | Build từ `server/Dockerfile`, tự động chạy `yarn db:generate` khi khởi động |
| **Frontend (`user-client`)** | **Cloud Run** | Build từ `user-client/Dockerfile` (`output: 'standalone'`) |
| **Database** | **Cloud SQL (PostgreSQL 16)** | Nạp schema/master data từ `server/db/sql/` hoặc file `yarn db:dump` |
| **Media (Video / DOC / PPT)** | **Cloud Storage (GCS)** | Mount trực tiếp GCS Bucket vào `/app/uploads` bằng Cloud Run Volume Mount (GCS FUSE) |
| **Container Registry** | **Artifact Registry** | Lưu trữ Docker image |
| **Cookie HTTPS Production** | Env trên `server` | Bật `COOKIE_SECURE=true` và `COOKIE_SAME_SITE=none` (nếu BE & FE khác domain `*.run.app`) hoặc `lax` (khi dùng chung domain cha) |

---

## 2. Chuẩn bị GCP CLI

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

## 3. Tạo Artifact Registry, Cloud SQL & Cloud Storage

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

# 3. Cloud Storage Bucket lưu video & tài liệu
export BUCKET_NAME="${PROJECT_ID}-vankinh-uploads"
gcloud storage buckets create gs://${BUCKET_NAME} --location=$REGION
```

---

## 4. Build & Deploy Backend (`server/`) lên Cloud Run

```bash
gcloud builds submit ./server \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/vankinh-repo/vankinh-server:latest

export INSTANCE_CONN=$(gcloud sql instances describe vankinh-pg --format="value(connectionName)")

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
  --set-env-vars "NODE_ENV=production,UPLOAD_DIR=/app/uploads,JWT_SECRET=CHANGE_TO_LONG_RANDOM_SECRET,JWT_EXPIRES_IN=7d,COOKIE_NAME=vankinh_token,COOKIE_SECURE=true,COOKIE_SAME_SITE=none,CORS_ORIGIN=https://YOUR_FRONTEND_URL,DATABASE_URL=postgresql://vankinh:CHANGE_THIS_STRONG_PASSWORD@localhost/vankinh_db?host=/cloudsql/${INSTANCE_CONN}"
```

### Đẩy dữ liệu SQL lên Cloud SQL (từ file `server/db/sql/` hoặc `yarn db:dump`)
Bạn có thể upload file SQL lên GCS rồi import trực tiếp vào Cloud SQL:
```bash
gcloud storage cp server/db/sql/01_schema.sql server/db/sql/02_master_data.sql gs://${BUCKET_NAME}/sql/
gcloud sql import sql vankinh-pg gs://${BUCKET_NAME}/sql/01_schema.sql --database=vankinh_db
gcloud sql import sql vankinh-pg gs://${BUCKET_NAME}/sql/02_master_data.sql --database=vankinh_db
```
*(Hoặc chạy `yarn db:dump` ở local rồi import `server/db/dumps/latest.sql` lên Cloud SQL!)*

---

## 5. Build & Deploy Frontend (`user-client/`) lên Cloud Run

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

Sau khi có URL Frontend, cập nhật lại `CORS_ORIGIN` trên `vankinh-server`:
```bash
gcloud run services update vankinh-server \
  --region $REGION \
  --update-env-vars "CORS_ORIGIN=https://vankinh-client-xxxxxx-as.a.run.app"
```

---

## 6. Gắn tên miền sau khi quyết định Domain
1. Vào **Cloud Run → Manage Custom Domains**:
   - Map `vankinh.vn` → `vankinh-client`
   - Map `api.vankinh.vn` → `vankinh-server`
2. Trỏ DNS theo hướng dẫn GCP để nhận SSL tự động.
3. Khi đã dùng chung tên miền cha (`vankinh.vn` và `api.vankinh.vn`), cập nhật `CORS_ORIGIN=https://vankinh.vn`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax` (và rebuild `user-client` với `NEXT_PUBLIC_API_URL=https://api.vankinh.vn/api`).
