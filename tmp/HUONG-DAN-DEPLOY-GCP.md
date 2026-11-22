# Hướng dẫn Deploy lên Google Cloud Platform (GCP)

Tài liệu hướng dẫn chuẩn bị hạ tầng GCP (**Artifact Registry, Cloud SQL, Cloud Storage, Cloud Run**) cho hệ thống **Chinese Learner**.

> **Lưu ý về 2 cách deploy code lên Cloud Run:**
> - **Deploy từ Repo GitHub (Khuyến nghị):** Bạn chỉ cần làm **Mục 2 & Mục 3** dưới đây **1 lần duy nhất** để tạo hạ tầng GCP, sau đó làm theo [HUONG-DAN-CICD-GITHUB.md](./HUONG-DAN-CICD-GITHUB.md) để GitHub tự động build & deploy mỗi khi push/merge vào nhánh `main`.
> - **Deploy trực tiếp từ code trên máy (Manual CLI):** Làm thêm **Mục 4 & Mục 5** dưới đây (dùng `gcloud builds submit` từ thư mục local).

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
gcloud artifacts repositories create chinese-learner-repo \
  --repository-format=docker \
  --location=$REGION

# 2. Cloud SQL PostgreSQL 16
gcloud sql instances create chinese-learner-pg \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION

gcloud sql databases create chinese_learner_db --instance=chinese-learner-pg
gcloud sql users create chinese_learner \
  --instance=chinese-learner-pg \
  --password="CHANGE_THIS_STRONG_PASSWORD"

# 3. Cloud Storage Bucket lưu video & tài liệu
export BUCKET_NAME="${PROJECT_ID}-chinese-learner-uploads"
gcloud storage buckets create gs://${BUCKET_NAME} --location=$REGION
```

---

## 4. Build & Deploy Backend (`server/`) lên Cloud Run

```bash
gcloud builds submit ./server \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/chinese-learner-repo/chinese-learner-server:latest

export INSTANCE_CONN=$(gcloud sql instances describe chinese-learner-pg --format="value(connectionName)")

gcloud run deploy chinese-learner-server \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/chinese-learner-repo/chinese-learner-server:latest \
  --region $REGION \
  --execution-environment gen2 \
  --allow-unauthenticated \
  --port 4000 \
  --memory 1Gi \
  --add-cloudsql-instances ${INSTANCE_CONN} \
  --add-volume name=uploads,type=cloud-storage,bucket=${BUCKET_NAME} \
  --add-volume-mount volume=uploads,mount-path=/app/uploads \
  --set-env-vars "NODE_ENV=production,UPLOAD_DIR=/app/uploads,JWT_SECRET=CHANGE_TO_LONG_RANDOM_SECRET,JWT_EXPIRES_IN=7d,COOKIE_NAME=chinese_learner_token,COOKIE_SECURE=true,COOKIE_SAME_SITE=none,CORS_ORIGIN=https://YOUR_FRONTEND_URL,DATABASE_URL=postgresql://chinese_learner:CHANGE_THIS_STRONG_PASSWORD@localhost/chinese_learner_db?host=/cloudsql/${INSTANCE_CONN}"
```

### Đẩy dữ liệu SQL lên Cloud SQL (từ `server/db/sql/`)
Bạn có thể upload các file SQL lên GCS rồi import trực tiếp vào Cloud SQL:
```bash
gcloud storage cp server/db/sql/01_schema.sql server/db/sql/02_master_data.sql server/db/sql/03_seed_data.sql gs://${BUCKET_NAME}/sql/
gcloud sql import sql chinese-learner-pg gs://${BUCKET_NAME}/sql/01_schema.sql --database=chinese_learner_db
gcloud sql import sql chinese-learner-pg gs://${BUCKET_NAME}/sql/02_master_data.sql --database=chinese_learner_db
# (Tùy chọn nếu muốn nạp dữ liệu đã dump từ local bằng `yarn db:dump`)
gcloud sql import sql chinese-learner-pg gs://${BUCKET_NAME}/sql/03_seed_data.sql --database=chinese_learner_db
```

---

## 5. Build & Deploy Frontend (`user-client/`) lên Cloud Run

```bash
export BACKEND_URL="https://chinese-learner-server-xxxxxx-as.a.run.app"

gcloud builds submit ./user-client \
  --config /dev/stdin <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_API_URL=${BACKEND_URL}/api'
      - '-t'
      - '${REGION}-docker.pkg.dev/${PROJECT_ID}/chinese-learner-repo/chinese-learner-client:latest'
      - '.'
images:
  - '${REGION}-docker.pkg.dev/${PROJECT_ID}/chinese-learner-repo/chinese-learner-client:latest'
EOF

gcloud run deploy chinese-learner-client \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/chinese-learner-repo/chinese-learner-client:latest \
  --region $REGION \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi
```

Sau khi có URL Frontend, cập nhật lại `CORS_ORIGIN` trên `chinese-learner-server`:
```bash
gcloud run services update chinese-learner-server \
  --region $REGION \
  --update-env-vars "CORS_ORIGIN=https://chinese-learner-client-xxxxxx-as.a.run.app"
```

---

## 6. Gắn tên miền sau khi quyết định Domain
1. Vào **Cloud Run → Manage Custom Domains**:
   - Map `chineselearner.vn` → `chinese-learner-client`
   - Map `api.chineselearner.vn` → `chinese-learner-server`
2. Trỏ DNS theo hướng dẫn GCP để nhận SSL tự động.
3. Khi đã dùng chung tên miền cha (`chineselearner.vn` và `api.chineselearner.vn`), cập nhật `CORS_ORIGIN=https://chineselearner.vn`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax` (và rebuild `user-client` với `NEXT_PUBLIC_API_URL=https://api.chineselearner.vn/api`).
