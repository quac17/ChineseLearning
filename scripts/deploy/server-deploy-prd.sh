#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_cmd gcloud
load_env_prd

require_var GCP_PROJECT_ID
require_var GCP_REGION
require_var GCP_ARTIFACT_REPO
require_var POSTGRES_USER
require_var POSTGRES_PASSWORD
require_var POSTGRES_DB
require_var DATABASE_URL
require_var JWT_SECRET
require_var CORS_ORIGIN
require_var APP_URL
require_var GCS_BUCKET
require_var PAYOS_CLIENT_ID
require_var PAYOS_API_KEY
require_var PAYOS_CHECKSUM_KEY
require_var MAIL_FROM
require_var SMTP_HOST
require_var SMTP_PORT
require_var SMTP_USER
require_var SMTP_PASS
require_var REMINDER_CRON_SECRET

PROJECT_ID="$GCP_PROJECT_ID"
REGION="$GCP_REGION"
REPO="$GCP_ARTIFACT_REPO"
SQL_INSTANCE="chinese-learner-pg"
SA_NAME="chinese-learner-server"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/chinese-learner-server:latest"

echo "=== [Server Deploy PRD] Project: ${PROJECT_ID} | Region: ${REGION} ==="
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud config set run/region "$REGION" >/dev/null

echo "→ Bật các API GCP cần thiết cho Backend..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com

ensure_artifact_repo "$REPO" "$REGION"

# 1. Cloud SQL
if ! gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  echo "→ Tạo Cloud SQL PostgreSQL 16 (${SQL_INSTANCE}) — có thể mất 5–10 phút..."
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --backup-start-time=18:00
else
  echo "✓ Cloud SQL '${SQL_INSTANCE}' đã tồn tại."
fi

if ! gcloud sql databases describe "$POSTGRES_DB" --instance="$SQL_INSTANCE" >/dev/null 2>&1; then
  echo "→ Tạo database ${POSTGRES_DB}..."
  gcloud sql databases create "$POSTGRES_DB" --instance="$SQL_INSTANCE"
fi

if ! gcloud sql users list --instance="$SQL_INSTANCE" --format="value(name)" | grep -qx "$POSTGRES_USER"; then
  echo "→ Tạo user database ${POSTGRES_USER}..."
  gcloud sql users create "$POSTGRES_USER" --instance="$SQL_INSTANCE" --password="$POSTGRES_PASSWORD"
fi

INSTANCE_CONN="$(gcloud sql instances describe "$SQL_INSTANCE" --format="value(connectionName)")"
echo "✓ Cloud SQL Connection: ${INSTANCE_CONN}"

# 2. Service Account & IAM
if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  echo "→ Tạo Service Account ${SA_EMAIL}..."
  gcloud iam service-accounts create "$SA_NAME" --display-name="Chinese Learner server"
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/cloudsql.client" --quiet >/dev/null

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/iam.serviceAccountTokenCreator" --quiet >/dev/null

# 3. Private GCS Bucket + CORS
if ! gcloud storage buckets describe "gs://${GCS_BUCKET}" >/dev/null 2>&1; then
  echo "→ Tạo Private Bucket gs://${GCS_BUCKET}..."
  gcloud storage buckets create "gs://${GCS_BUCKET}" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --public-access-prevention
else
  echo "✓ Bucket gs://${GCS_BUCKET} đã tồn tại."
fi

gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/storage.objectAdmin" --quiet >/dev/null

CORS_TMP="$(mktemp)"
trap 'rm -f "$CORS_TMP"' EXIT
# Chuyển CORS_ORIGIN (dạng a,b) thành mảng JSON
CORS_JSON_ORIGINS="$(printf '%s' "$CORS_ORIGIN" | awk -F',' '{for(i=1;i<=NF;i++){gsub(/^ +| +$/,"",$i); printf "%s\"%s\"", (i>1?", ":""), $i}}')"
cat > "$CORS_TMP" <<EOF
[
  {
    "origin": [${CORS_JSON_ORIGINS}],
    "method": ["PUT"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF
gcloud storage buckets update "gs://${GCS_BUCKET}" --cors-file="$CORS_TMP" >/dev/null
echo "✓ Đã cập nhật CORS cho bucket gs://${GCS_BUCKET}."

# 4. Secret Manager
upsert_secret() {
  local name="$1"
  local value="$2"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- >/dev/null
    echo "→ Đã tạo secret: ${name}"
  else
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
    echo "✓ Đã cập nhật phiên bản mới cho secret: ${name}"
  fi
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor" --quiet >/dev/null
}

upsert_secret "chinese-learner-jwt-secret" "$JWT_SECRET"
upsert_secret "chinese-learner-database-url" "$DATABASE_URL"
upsert_secret "chinese-learner-payos-client-id" "$PAYOS_CLIENT_ID"
upsert_secret "chinese-learner-payos-api-key" "$PAYOS_API_KEY"
upsert_secret "chinese-learner-payos-checksum-key" "$PAYOS_CHECKSUM_KEY"
upsert_secret "chinese-learner-smtp-pass" "$SMTP_PASS"
upsert_secret "chinese-learner-reminder-cron-secret" "$REMINDER_CRON_SECRET"

# 5. Build & Deploy Backend
echo "→ Build Docker image Server..."
gcloud builds submit "${ROOT_DIR}/server" --tag "$IMAGE"

echo "→ Deploy chinese-learner-server lên Cloud Run..."
gcloud run deploy chinese-learner-server \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 3600 \
  --add-cloudsql-instances "$INSTANCE_CONN" \
  --set-env-vars "^@^NODE_ENV=production@JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-7d}@COOKIE_NAME=${COOKIE_NAME:-chinese_learner_token}@COOKIE_SECURE=${COOKIE_SECURE:-true}@COOKIE_SAME_SITE=${COOKIE_SAME_SITE:-lax}@CORS_ORIGIN=${CORS_ORIGIN}@APP_URL=${APP_URL}@API_PUBLIC_URL=${API_PUBLIC_URL:-}@PAYMENT_GATEWAY=payos@STORAGE_BACKEND=gcs@GCS_BUCKET=${GCS_BUCKET}@GCS_SIGNED_URL_TTL_MIN=${GCS_SIGNED_URL_TTL_MIN:-15}@GCS_UPLOAD_URL_TTL_MIN=${GCS_UPLOAD_URL_TTL_MIN:-30}@MAX_VIDEO_SIZE_MB=${MAX_VIDEO_SIZE_MB:-2000}@MAX_DOC_SIZE_MB=${MAX_DOC_SIZE_MB:-30}@MAIL_TRANSPORT=smtp@MAIL_FROM=${MAIL_FROM}@SMTP_HOST=${SMTP_HOST}@SMTP_PORT=${SMTP_PORT}@SMTP_USER=${SMTP_USER}@MAIL_DEV_OUTBOX=false@TRUST_PROXY=${TRUST_PROXY:-1}" \
  --set-secrets "JWT_SECRET=chinese-learner-jwt-secret:latest,DATABASE_URL=chinese-learner-database-url:latest,PAYOS_CLIENT_ID=chinese-learner-payos-client-id:latest,PAYOS_API_KEY=chinese-learner-payos-api-key:latest,PAYOS_CHECKSUM_KEY=chinese-learner-payos-checksum-key:latest,SMTP_PASS=chinese-learner-smtp-pass:latest,REMINDER_CRON_SECRET=chinese-learner-reminder-cron-secret:latest"

API_URL="$(gcloud run services describe chinese-learner-server --region "$REGION" --format="value(status.url)")"
echo "✔ Deploy Backend thành công: ${API_URL}"
echo "  Lưu ý: Nếu là lần đầu tạo Cloud SQL, hãy chạy schema & migrations theo tmp/HUONG-DAN-DEPLOY-GCP.md mục 7."
