#!/usr/bin/env bash
#
# Build the TSI data-pipeline image inside Azure Container Registry and push it,
# server-side — no local Docker daemon required. ACR builds straight from the
# Dockerfile and the uploaded build context (see ../.dockerignore).
#
# Usage:
#   scripts/acr_build.sh                 # tags :latest and :<git-sha>
#   scripts/acr_build.sh v1.2.0          # tags :v1.2.0 and :<git-sha>
#
# Reads ACR_NAME / AZURE_SUBSCRIPTION_ID (and SP creds for non-interactive
# login) from the repo-root .env. Run from anywhere; it cd's to the repo root.

set -euo pipefail

# --- locate repo root (this script lives in scripts/) ---
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- load .env (export every var) ---
if [[ ! -f .env ]]; then
  echo "ERROR: .env not found at repo root. Need ACR_NAME (and Azure creds)." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${ACR_NAME:?ACR_NAME must be set in .env}"
# Login server is NOT always <name>.azurecr.io — this registry has
# "domain name label scope" enabled, so it carries a hash suffix. Always use
# ACR_LOGIN_SERVER for image refs; fall back only if it's unset.
LOGIN_SERVER="${ACR_LOGIN_SERVER:-${ACR_NAME}.azurecr.io}"

IMAGE_NAME="tsi-pipeline"
EXTRA_TAG="${1:-latest}"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"

# --- ensure the Azure CLI is authenticated ---
# Prefer an existing *valid* session; otherwise fall back to the service
# principal in .env (non-interactive / CI-friendly). We probe with
# get-access-token, not `az account show` — the latter succeeds from cache even
# when the refresh token has expired, which silently breaks the build later.
if ! az account get-access-token >/dev/null 2>&1; then
  echo ">> No active az session; logging in with service principal from .env..."
  : "${AZURE_CLIENT_ID:?}" "${AZURE_CLIENT_SECRET:?}" "${AZURE_TENANT_ID:?}"
  az login --service-principal \
    --username "$AZURE_CLIENT_ID" \
    --password "$AZURE_CLIENT_SECRET" \
    --tenant "$AZURE_TENANT_ID" >/dev/null
fi

if [[ -n "${AZURE_SUBSCRIPTION_ID:-}" ]]; then
  az account set --subscription "$AZURE_SUBSCRIPTION_ID"
fi

echo ">> Building ${LOGIN_SERVER}/${IMAGE_NAME} (tags: ${EXTRA_TAG}, ${GIT_SHA})"

# ACR uploads the context (minus .dockerignore), builds remotely, and pushes
# both tags. --image may be repeated to apply multiple tags to one build.
az acr build \
  --registry "$ACR_NAME" \
  --file Dockerfile \
  --image "${IMAGE_NAME}:${EXTRA_TAG}" \
  --image "${IMAGE_NAME}:${GIT_SHA}" \
  .

echo ">> Done. Pull with:"
echo "   az acr login --name ${ACR_NAME}"
echo "   docker pull ${LOGIN_SERVER}/${IMAGE_NAME}:${EXTRA_TAG}"
