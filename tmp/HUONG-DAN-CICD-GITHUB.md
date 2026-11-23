# Hướng dẫn CI/CD & Pre-push Hook (GitHub Actions + GCP Cloud Run)

Tài liệu này mô tả quy trình **CI/CD** của dự án **Chinese Learner** (`server/` + `user-client/` + `e2e/`):
- **Pre-push Hook (Local):** Chạy toàn bộ kiểm tra TypeScript, build và unit test trước khi `git push`, giúp phát hiện lỗi sớm trước khi đẩy lên GitHub.
- **CI (Continuous Integration):** Đã cấu hình sẵn tại `.github/workflows/ci.yml`. Mỗi khi mở Pull Request hoặc push lên `main`, GitHub Actions tự động chạy build + unit tests (Server), build + type-check (Client), và E2E Playwright với PostgreSQL 16.
- **CD (Continuous Delivery/Deployment):** Mẫu workflow `.github/workflows/deploy-gcp.yml` để tự động build Docker image, đẩy lên **GCP Artifact Registry** và deploy lên **GCP Cloud Run** khi merge vào `main`.

---

## 1. Kiểm tra CI tại Local bằng Pre-push Hook

Repo đã tích hợp sẵn `.githooks/pre-push` và `scripts/ci-check.mjs`:

```bash
# Cài đặt hook một lần sau khi clone repo
yarn hooks:install
```

- Mỗi lần chạy `git push`, hook tự động chạy `node scripts/ci-check.mjs`:
  1. `[1/4]` Server TypeScript check (`yarn --cwd server tsc --noEmit`)
  2. `[2/4]` Server build (`yarn --cwd server build`)
  3. `[3/4]` Server unit tests (`yarn --cwd server test --runInBand` trên Windows hoặc `--ci` trên Linux/macOS)
  4. `[4/4]` Client TypeScript check + Next.js build (`yarn --cwd user-client tsc --noEmit && yarn --cwd user-client build`)
- Chạy thủ công bất kỳ lúc nào:
  - `yarn check:ci` — chạy 4 bước trên (nhanh, không gồm E2E).
  - `yarn check:all` (hoặc `RUN_E2E=1 git push`) — chạy cả 4 bước trên + `[5/5]` E2E Playwright (`yarn e2e`).

---

## 2. Workflow CI hiện tại (`.github/workflows/ci.yml`)

Workflow CI đang hoạt động trong repo gồm 3 job:
1. **`server` (`Server (build + unit tests)`)**: dùng Node 20, `yarn install --frozen-lockfile`, `yarn build`, `yarn test --ci`.
2. **`client` (`Client (build + type-check)`)**: dùng Node 20, `yarn install --frozen-lockfile`, `yarn build` với `NEXT_PUBLIC_API_URL=http://localhost:4000/api`.
3. **`e2e` (`E2E (Playwright)`)**: chạy sau khi `server` và `client` pass (`needs: [server, client]`), bật service `postgres:16` trên cổng `5433`, cài Chromium của Playwright và chạy `yarn e2e` trên DB test `chinese_learner_test`. Nếu fail sẽ upload `playwright-report/` và `test-results/` làm artifact trong 7 ngày.

> **Lưu ý:** Vì CI dùng `yarn install --frozen-lockfile`, không tự ý sửa `package.json` mà quên cập nhật `yarn.lock`.

---

## 3. Thiết lập CD (Tự động Deploy lên GCP Cloud Run)

### Bước 3.1: Chuẩn bị quyền truy cập GCP cho GitHub Actions

Có 2 cách kết nối GitHub Actions với GCP: **Service Account JSON** (nhanh) hoặc **Workload Identity Federation** (khuyến nghị cho production, không lưu key tĩnh).

```bash
export PROJECT_ID="YOUR_PROJECT_ID"
export SA_NAME="github-deployer"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create $SA_NAME \
  --display-name="GitHub Actions Deployer for Chinese Learner"

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

Tạo key JSON (nếu dùng cách 1):
```bash
gcloud iam service-accounts keys create gcp-sa-key.json --iam-account=$SA_EMAIL
```
Dán nội dung vào GitHub Secret `GCP_SA_KEY`, sau đó **xóa file `gcp-sa-key.json` khỏi máy** (tuyệt đối không commit lên Git).

### Bước 3.2: Khai báo Variables & Secrets trên GitHub Repository

Vào GitHub Repo → **Settings** → **Secrets and variables** → **Actions**:

#### A. Tab `Variables` (Thông số không nhạy cảm)
| Tên Variable | Giá trị ví dụ |
|---|---|
| `GCP_PROJECT_ID` | `chinese-learner-prod-123456` |
| `GCP_REGION` | `asia-southeast1` |
| `GCP_ARTIFACT_REPO` | `chinese-learner-repo` |
| `GCP_RUNTIME_SA` | `chinese-learner-server@chinese-learner-prod-123456.iam.gserviceaccount.com` |
| `CLOUD_SQL_CONNECTION` | `chinese-learner-prod-123456:asia-southeast1:chinese-learner-pg` |
| `GCS_BUCKET` | `chinese-learner-prod-123456-chinese-learner-media` |
| `NEXT_PUBLIC_API_URL` | `https://api.chineselearner.vn/api` |
| `NEXT_PUBLIC_SUPPORT_CONTACT` | `Zalo 09xx xxx xxx` *(tuỳ chọn)* |
| `NEXT_PUBLIC_REFUND_POLICY` | `Chính sách hoàn tiền...` *(tuỳ chọn)* |
| `CORS_ORIGIN` | `https://chineselearner.vn,https://www.chineselearner.vn` |
| `APP_URL` | `https://chineselearner.vn` |
| `COOKIE_SAME_SITE` | `lax` *(đổi thành `none` nếu FE & BE khác tên miền `*.run.app`)* |
| `MAIL_FROM` | `Chinese Learner <no-reply@chineselearner.vn>` |
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `resend` |

#### B. Tab `Secrets` (Thông tin bí mật)
| Tên Secret | Giá trị |
|---|---|
| `GCP_SA_KEY` | Toàn bộ nội dung file JSON của `github-deployer` |

*(Các biến nhạy cảm runtime như `JWT_SECRET`, `DATABASE_URL`, `PAYOS_*`, `SMTP_PASS`, `REMINDER_CRON_SECRET` đã được lưu trong **GCP Secret Manager** theo `tmp/HUONG-DAN-DEPLOY-GCP.md` mục 6 và gắn qua `--set-secrets`.)*

### Bước 3.3: File `.github/workflows/deploy-gcp.yml`

```yaml
name: CD - Deploy to GCP Cloud Run

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
  REGION: ${{ vars.GCP_REGION }}
  ARTIFACT_REPO: ${{ vars.GCP_ARTIFACT_REPO }}

jobs:
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
            --service-account "${{ vars.GCP_RUNTIME_SA }}" \
            --allow-unauthenticated \
            --memory 1Gi \
            --timeout 3600 \
            --add-cloudsql-instances "${{ vars.CLOUD_SQL_CONNECTION }}" \
            --set-env-vars "^@^NODE_ENV=production@JWT_EXPIRES_IN=7d@COOKIE_NAME=chinese_learner_token@COOKIE_SECURE=true@COOKIE_SAME_SITE=${{ vars.COOKIE_SAME_SITE }}@CORS_ORIGIN=${{ vars.CORS_ORIGIN }}@APP_URL=${{ vars.APP_URL }}@PAYMENT_GATEWAY=payos@STORAGE_BACKEND=gcs@GCS_BUCKET=${{ vars.GCS_BUCKET }}@GCS_SIGNED_URL_TTL_MIN=15@GCS_UPLOAD_URL_TTL_MIN=30@MAX_VIDEO_SIZE_MB=2000@MAX_DOC_SIZE_MB=30@MAIL_TRANSPORT=smtp@MAIL_FROM=${{ vars.MAIL_FROM }}@SMTP_HOST=${{ vars.SMTP_HOST }}@SMTP_PORT=${{ vars.SMTP_PORT }}@SMTP_USER=${{ vars.SMTP_USER }}@MAIL_DEV_OUTBOX=false@TRUST_PROXY=1" \
            --set-secrets "JWT_SECRET=chinese-learner-jwt-secret:latest,DATABASE_URL=chinese-learner-database-url:latest,PAYOS_CLIENT_ID=chinese-learner-payos-client-id:latest,PAYOS_API_KEY=chinese-learner-payos-api-key:latest,PAYOS_CHECKSUM_KEY=chinese-learner-payos-checksum-key:latest,SMTP_PASS=chinese-learner-smtp-pass:latest,REMINDER_CRON_SECRET=chinese-learner-reminder-cron-secret:latest"

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
            --build-arg "NEXT_PUBLIC_SUPPORT_CONTACT=${{ vars.NEXT_PUBLIC_SUPPORT_CONTACT }}" \
            --build-arg "NEXT_PUBLIC_REFUND_POLICY=${{ vars.NEXT_PUBLIC_REFUND_POLICY }}" \
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
            --memory 512Mi
```

---

## 4. Quy tắc làm việc Git & Database an toàn với CI/CD

1. **Bảo vệ nhánh `main` (Branch Protection):**
   - Vào **Settings → Branches → Add branch protection rule** cho nhánh `main`:
     - Bật **Require a pull request before merging**.
     - Bật **Require status checks to pass before merging** → chọn `Server (build + unit tests)`, `Client (build + type-check)`, và `E2E (Playwright)`.
2. **Xử lý thay đổi Database SQL thuần trên Production:**
   - `server/Dockerfile` **không** tự chạy `yarn db:generate` khi khởi động.
   - Mọi thay đổi bảng/cột mới phải viết thành file migration idempotent (`IF NOT EXISTS`, `BEGIN/COMMIT`) trong `server/db/migrations/YYYYMMDD_HHMM_*.sql` và chạy tay **trước** khi deploy bản server mới (xem `tmp/HUONG-DAN-DEPLOY-GCP.md` mục 7).
   - **TUYỆT ĐỐI KHÔNG** chạy `yarn db:reset`, `yarn db:seed`, `yarn db:demo` hay `yarn db:dump` trên DB production.
3. **Rollback nhanh khi gặp sự cố:**
   - Vào **GCP Console → Cloud Run → Revisions** → chọn bản cũ ổn định nhất → bấm **Manage Traffic → 100%** để khôi phục ngay lập tức.
