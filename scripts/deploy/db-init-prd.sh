#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_cmd gcloud
require_cmd node
require_cmd curl
load_env_prd

require_var GCP_PROJECT_ID
require_var GCP_REGION
require_var POSTGRES_USER
require_var POSTGRES_PASSWORD
require_var POSTGRES_DB

PROJECT_ID="$GCP_PROJECT_ID"
SQL_INSTANCE="chinese-learner-pg"
PROXY_PORT="${PRD_PG_PORT:-5434}"

echo "=== [Database Deploy PRD] Project: ${PROJECT_ID} | DB: ${POSTGRES_DB} ==="
gcloud config set project "$PROJECT_ID" >/dev/null

# Xác định INSTANCE_CONN từ .env.prd hoặc hỏi trực tiếp từ GCP
if [ -n "${CLOUD_SQL_CONNECTION:-}" ] && [[ "${CLOUD_SQL_CONNECTION}" != YOUR_* ]]; then
  INSTANCE_CONN="$CLOUD_SQL_CONNECTION"
else
  INSTANCE_CONN="$(gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(connectionName)" | tr -d '\r\n')"
fi
echo "✓ Cloud SQL Instance: ${INSTANCE_CONN}"

# Tìm cloud-sql-proxy có sẵn hoặc tải bản chính thức của Google vào thư mục tạm
PROXY_BIN=""
if command -v cloud-sql-proxy >/dev/null 2>&1; then
  PROXY_BIN="$(command -v cloud-sql-proxy)"
else
  PROXY_VERSION="v2.14.3"
  UNAME_S="$(uname -s)"
  UNAME_M="$(uname -m)"
  case "$UNAME_S" in
    MINGW*|MSYS*|CYGWIN*)
      PROXY_ASSET="cloud-sql-proxy.x64.exe"
      PROXY_BIN="${TMPDIR:-/tmp}/chinese-learner-cloud-sql-proxy-${PROXY_VERSION}.exe"
      ;;
    Darwin*)
      if [ "$UNAME_M" = "arm64" ]; then
        PROXY_ASSET="cloud-sql-proxy.darwin.arm64"
      else
        PROXY_ASSET="cloud-sql-proxy.darwin.amd64"
      fi
      PROXY_BIN="${TMPDIR:-/tmp}/chinese-learner-cloud-sql-proxy-${PROXY_VERSION}"
      ;;
    *)
      PROXY_ASSET="cloud-sql-proxy.linux.amd64"
      PROXY_BIN="${TMPDIR:-/tmp}/chinese-learner-cloud-sql-proxy-${PROXY_VERSION}"
      ;;
  esac

  if [ ! -f "$PROXY_BIN" ]; then
    PROXY_URL="https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${PROXY_VERSION}/${PROXY_ASSET}"
    echo "→ Tải Cloud SQL Auth Proxy (${PROXY_ASSET}) vào thư mục tạm..."
    curl -fsSL "$PROXY_URL" -o "$PROXY_BIN"
    chmod +x "$PROXY_BIN" || true
  fi
fi

echo "→ Lấy access token từ phiên đăng nhập gcloud..."
ACCESS_TOKEN="$(gcloud auth print-access-token | tr -d '\r\n')"

echo "→ Khởi chạy Cloud SQL Auth Proxy trên cổng 127.0.0.1:${PROXY_PORT}..."
"$PROXY_BIN" "$INSTANCE_CONN" --address 127.0.0.1 --port "$PROXY_PORT" --token "$ACCESS_TOKEN" >/dev/null 2>&1 &
PROXY_PID=$!
trap 'kill "$PROXY_PID" >/dev/null 2>&1 || true' EXIT

cd "$ROOT_DIR"
PRD_PG_HOST="127.0.0.1" PRD_PG_PORT="$PROXY_PORT" node scripts/deploy/run-prd-sql.mjs
