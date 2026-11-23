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
require_var NEXT_PUBLIC_API_URL

PROJECT_ID="$GCP_PROJECT_ID"
REGION="$GCP_REGION"
REPO="$GCP_ARTIFACT_REPO"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/chinese-learner-client:latest"

echo "=== [Client Deploy PRD] Project: ${PROJECT_ID} | Region: ${REGION} ==="
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud config set run/region "$REGION" >/dev/null

echo "→ Bật các API GCP cần thiết cho Frontend..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

ensure_artifact_repo "$REPO" "$REGION"

CB_TMP="$(mktemp)"
trap 'rm -f "$CB_TMP"' EXIT
cat > "$CB_TMP" <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}'
      - '--build-arg'
      - 'NEXT_PUBLIC_SUPPORT_CONTACT=${NEXT_PUBLIC_SUPPORT_CONTACT:-}'
      - '--build-arg'
      - 'NEXT_PUBLIC_REFUND_POLICY=${NEXT_PUBLIC_REFUND_POLICY:-}'
      - '-t'
      - '${IMAGE}'
      - '.'
images:
  - '${IMAGE}'
EOF

echo "→ Build Docker image Client với NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}..."
gcloud builds submit "${ROOT_DIR}/user-client" --config "$CB_TMP"

echo "→ Deploy chinese-learner-client lên Cloud Run..."
gcloud run deploy chinese-learner-client \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 512Mi

WEB_URL="$(gcloud run services describe chinese-learner-client --region "$REGION" --format="value(status.url)")"
echo "✔ Deploy Frontend thành công: ${WEB_URL}"
