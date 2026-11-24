#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.prd"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Lỗi: Không tìm thấy lệnh '$1'. Vui lòng cài đặt trước khi chạy." >&2
    exit 1
  fi
}

load_env_prd() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "Lỗi: Không tìm thấy file .env.prd. Hãy chạy 'yarn env_prd' rồi điền đầy đủ thông số." >&2
    exit 1
  fi

  # Đọc .env.prd an toàn (bỏ qua comment, dòng trống và ký tự CR trên Windows)
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|\#*) continue ;;
    esac
    if [[ "$line" == *=* ]]; then
      key="${line%%=*}"
      val="${line#*=}"
      # Bỏ dấu nháy kép/đơn bao quanh nếu có
      if [[ "$val" =~ ^\"(.*)\"$ ]]; then
        val="${BASH_REMATCH[1]}"
      elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
        val="${BASH_REMATCH[1]}"
      fi
      export "${key}=${val}"
    fi
  done < "$ENV_FILE"
}

require_var() {
  local name="$1"
  local val="${!name:-}"
  if [ -z "$val" ] || [[ "$val" == YOUR_* ]] || [[ "$val" == CHANGE_* ]]; then
    echo "Lỗi: Biến '${name}' trong .env.prd chưa được điền giá trị thật (hiện tại: '${val}')." >&2
    exit 1
  fi
}

ensure_artifact_repo() {
  local repo="$1"
  local region="$2"
  if ! gcloud artifacts repositories describe "$repo" --location="$region" >/dev/null 2>&1; then
    echo "→ Tạo Artifact Registry repository: ${repo} (${region})..."
    gcloud artifacts repositories create "$repo" \
      --repository-format=docker \
      --location="$region"
  else
    echo "✓ Artifact Registry '${repo}' đã tồn tại."
  fi
}

ensure_cloudbuild_permissions() {
  local project_id="$1"
  local project_number=""
  local attempt

  # Dùng --billing-project để tính quota vào project riêng thay vì project mặc định dùng chung của gcloud CLI (tránh lỗi 429)
  for attempt in 1 2 3; do
    if project_number="$(gcloud projects describe "$project_id" --billing-project="$project_id" --format="value(projectNumber)" 2>/dev/null)" && [ -n "$project_number" ]; then
      break
    fi
    if project_number="$(gcloud projects describe "$project_id" --format="value(projectNumber)" 2>/dev/null)" && [ -n "$project_number" ]; then
      break
    fi
    echo "⏳ Đang thử lại lấy thông tin project (lần ${attempt}/3)..."
    sleep 3
  done

  if [ -z "$project_number" ]; then
    echo "⚠ Không đọc được projectNumber do giới hạn tạm thời của Cloud Resource Manager; tiếp tục dùng quyền Cloud Build đã cấp trước đó."
    return 0
  fi

  local compute_sa="${project_number}-compute@developer.gserviceaccount.com"
  echo "→ Cấp quyền Cloud Build cho ${compute_sa}..."
  gcloud projects add-iam-policy-binding "$project_id" \
    --billing-project="$project_id" \
    --member="serviceAccount:${compute_sa}" \
    --role="roles/cloudbuild.builds.builder" \
    --quiet >/dev/null || true
  gcloud projects add-iam-policy-binding "$project_id" \
    --billing-project="$project_id" \
    --member="serviceAccount:${compute_sa}" \
    --role="roles/storage.objectAdmin" \
    --quiet >/dev/null || true
}
