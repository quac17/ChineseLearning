# Hướng dẫn Setup CI/CD trên GitHub Actions (Deploy tự động lên GCP Cloud Run)

Tài liệu này hướng dẫn thiết lập quy trình **CI/CD hoàn chỉnh trên GitHub** cho dự án **Chinese Learner** (`server/` + `user-client/`):
- **CI (Continuous Integration):** Mỗi khi tạo Pull Request hoặc push code, GitHub tự động cài gói bằng Yarn, kiểm tra TypeScript (`tsc --noEmit`) và chạy build kiểm thử cho cả Backend và Frontend.
- **CD (Continuous Delivery/Deployment):** Khi merge code vào nhánh `main`, GitHub tự động build Docker image, đẩy lên **GCP Artifact Registry** và deploy bản mới lên **GCP Cloud Run** (chỉ deploy phần nào có thay đổi code để tiết kiệm thời gian & chi phí).

---

## 1. Chuẩn bị quyền truy cập GCP cho GitHub Actions

Có 2 cách kết nối GitHub Actions với GCP. **Cách 1 (Service Account JSON)** dễ làm nhanh trong 3 phút; **Cách 2 (Workload Identity Federation)** bảo mật cao hơn cho môi trường Production (không lưu file key tĩnh).

### Bước 1.1: Tạo Service Account trên GCP
Chạy các lệnh sau trên máy (hoặc Google Cloud Shell):

```bash
export PROJECT_ID="YOUR_PROJECT_ID"
export SA_NAME="github-deployer"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# 1. Tạo Service Account
gcloud iam service-accounts create $SA_NAME \
  --display-name="GitHub Actions Deployer for Chinese Learner"

# 2. Cấp quyền cần thiết (Build, Push Artifact Registry, Deploy Cloud Run)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

### Bước 1.2: Tạo Key JSON (Cách 1 — nhanh gọn)
```bash
gcloud iam service-accounts keys create gcp-sa-key.json \
  --iam-account=$SA_EMAIL
```
Mở file `gcp-sa-key.json`, copy toàn bộ nội dung để dán vào GitHub Secret `GCP_SA_KEY`, sau đó **xóa file `gcp-sa-key.json` khỏi máy** (tuyệt đối không commit lên Git!).

*(Nếu muốn dùng **Cách 2 — Workload Identity Federation không cần JSON key**, tạo Workload Identity Pool & Provider trên GCP IAM trỏ tới repo GitHub của bạn, rồi truyền `workload_identity_provider` và `service_account` vào action `google-github-actions/auth@v2`.)*

---

## 2. Khai báo Secrets & Variables trên GitHub Repository

Vào GitHub Repo → **Settings** → **Secrets and variables** → **Actions**:

### A. Tab `Variables` (Thông số không nhạy cảm)
| Tên Variable | Giá trị ví dụ |
|---|---|
| `GCP_PROJECT_ID` | `chinese-learner-prod-123456` |
| `GCP_REGION` | `asia-southeast1` |
| `GCP_ARTIFACT_REPO` | `chinese-learner-repo` |
| `CLOUD_SQL_CONNECTION` | `chinese-learner-prod-123456:asia-southeast1:chinese-learner-pg` |
| `GCS_UPLOAD_BUCKET` | `chinese-learner-prod-123456-chinese-learner-uploads` |
| `NEXT_PUBLIC_API_URL` | `https://api.chineselearner.vn/api` *(hoặc URL `*.run.app/api` nếu chưa có tên miền)* |
| `CORS_ORIGIN` | `https://chineselearner.vn,https://www.chineselearner.vn` |
| `COOKIE_SAME_SITE` | `lax` *(đổi thành `none` nếu FE & BE khác tên miền `*.run.app`)* |

### B. Tab `Secrets` (Thông tin bí mật)
| Tên Secret | Giá trị |
|---|---|
| `GCP_SA_KEY` | Toàn bộ nội dung file JSON ở Bước 1.2 |
| `DATABASE_URL` | `postgresql://chinese_learner:MAT_KHAU_MANH@localhost/chinese_learner_db?host=/cloudsql/PROJECT:REGION:chinese-learner-pg` |
| `JWT_SECRET` | Chuỗi ngẫu nhiên dài tối thiểu 32–64 ký tự |

---

## 3. Tạo 2 file Workflow trong `.github/workflows/`

Tạo thư mục `.github/workflows/` ở gốc repo và thêm 2 file sau:

### File 1: `.github/workflows/ci.yml` (Tự động kiểm tra code khi tạo PR / Push)

```yaml
name: CI - Check & Build (Server + Client)

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [develop]

jobs:
  check-server:
    name: Backend (NestJS) Type-check & Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
          cache-dependency-path: server/yarn.lock

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: TypeScript type-check
        run: npx tsc --noEmit

      - name: Build NestJS
        run: yarn build

  check-client:
    name: Frontend (Next.js) Type-check & Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: user-client
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
          cache-dependency-path: user-client/yarn.lock

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: TypeScript type-check
        run: npx tsc --noEmit

      - name: Build Next.js
        env:
          NEXT_PUBLIC_API_URL: http://localhost:4000/api
        run: yarn build
```

---

### File 2: `.github/workflows/deploy-gcp.yml` (Tự động Deploy lên GCP Cloud Run khi merge vào `main`)

```yaml
name: CD - Deploy to GCP Cloud Run

on:
  push:
    branches: [main]
  workflow_dispatch: # Cho phép bấm chạy deploy thủ công trên giao diện GitHub

env:
  PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
  REGION: ${{ vars.GCP_REGION }}
  ARTIFACT_REPO: ${{ vars.GCP_ARTIFACT_REPO }}

jobs:
  # Phát hiện phần nào thay đổi để không build thừa
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      server: ${{ steps.filter.outputs.server }}
      client: ${{ steps.filter.outputs.client }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            server:
              - 'server/**'
            client:
              - 'user-client/**'

  deploy-server:
    name: Build & Deploy Backend (chinese-learner-server)
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.server == 'true' || github.event_name == 'workflow_dispatch' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev --quiet

      - name: Build & Push Server Docker Image
        run: |
          IMAGE="${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.ARTIFACT_REPO }}/chinese-learner-server:${{ github.sha }}"
          LATEST="${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.ARTIFACT_REPO }}/chinese-learner-server:latest"
          docker build -t "$IMAGE" -t "$LATEST" ./server
          docker push "$IMAGE"
          docker push "$LATEST"

      - name: Deploy Server to Cloud Run
        run: |
          IMAGE="${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.ARTIFACT_REPO }}/chinese-learner-server:${{ github.sha }}"
          gcloud run deploy chinese-learner-server \
            --image "$IMAGE" \
            --region "${{ env.REGION }}" \
            --execution-environment gen2 \
            --allow-unauthenticated \
            --port 4000 \
            --memory 1Gi \
            --add-cloudsql-instances "${{ vars.CLOUD_SQL_CONNECTION }}" \
            --add-volume "name=uploads,type=cloud-storage,bucket=${{ vars.GCS_UPLOAD_BUCKET }}" \
            --add-volume-mount "volume=uploads,mount-path=/app/uploads" \
            --set-env-vars "NODE_ENV=production,UPLOAD_DIR=/app/uploads,JWT_EXPIRES_IN=7d,COOKIE_NAME=chinese_learner_token,COOKIE_SECURE=true,COOKIE_SAME_SITE=${{ vars.COOKIE_SAME_SITE }},CORS_ORIGIN=${{ vars.CORS_ORIGIN }},JWT_SECRET=${{ secrets.JWT_SECRET }},DATABASE_URL=${{ secrets.DATABASE_URL }}"

  deploy-client:
    name: Build & Deploy Frontend (chinese-learner-client)
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.client == 'true' || github.event_name == 'workflow_dispatch' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev --quiet

      - name: Build & Push Client Docker Image
        run: |
          IMAGE="${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.ARTIFACT_REPO }}/chinese-learner-client:${{ github.sha }}"
          LATEST="${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.ARTIFACT_REPO }}/chinese-learner-client:latest"
          docker build \
            --build-arg "NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL }}" \
            -t "$IMAGE" -t "$LATEST" ./user-client
          docker push "$IMAGE"
          docker push "$LATEST"

      - name: Deploy Client to Cloud Run
        run: |
          IMAGE="${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.ARTIFACT_REPO }}/chinese-learner-client:${{ github.sha }}"
          gcloud run deploy chinese-learner-client \
            --image "$IMAGE" \
            --region "${{ env.REGION }}" \
            --allow-unauthenticated \
            --port 3000 \
            --memory 512Mi
```

---

## 4. Quy tắc làm việc Git & Database an toàn với CI/CD

1. **Bảo vệ nhánh `main` (Branch Protection):**
   - Vào **Settings → Branches → Add branch protection rule** cho nhánh `main`:
     - Bật **Require a pull request before merging**.
     - Bật **Require status checks to pass before merging** → chọn `Backend (NestJS) Type-check & Build` và `Frontend (Next.js) Type-check & Build`.
   - Đảm bảo không ai push trực tiếp code lỗi lên production.
2. **Xử lý thay đổi Database SQL thuần trên Production:**
   - Khi container `chinese-learner-server` khởi động trên Cloud Run, `server/Dockerfile` tự động chạy `yarn db:generate` (an toàn vì chỉ dùng `CREATE TABLE IF NOT EXISTS` và `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
   - **TUYỆT ĐỐI KHÔNG** chạy `yarn db:reset` hay `yarn db:seed` tự động trong CI/CD production để tránh ghi đè dữ liệu thật của học viên.
   - Khi có thay đổi cột/bảng mới, hãy thêm câu lệnh `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` vào cuối `server/db/sql/01_schema.sql` và kiểm thử trước bằng `yarn db:generate` ở local.
3. **Rollback nhanh khi gặp sự cố:**
   - Cloud Run tự lưu lịch sử mọi Revision cũ. Nếu bản deploy mới gặp lỗi, vào **GCP Console → Cloud Run → Revisions** → chọn bản cũ ổn định nhất → bấm **Manage Traffic → 100%** để khôi phục trong 5 giây.
