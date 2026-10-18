#!/usr/bin/env bash
# Client-operable refresh: one manual Azure Container Apps Job
# (docs/requirements-v2.md section 3). Creates billable resources. Review every
# variable, then run once from a shell that is logged in with `az login` on the
# PlanCatalyst subscription with Owner or User Access Administrator on the
# resource group (role assignments need it).
#
# What this creates, in order:
#   1. Private Blob container for ND-GAIN uploads           (REQ3.3)
#   2. Log Analytics workspace + Container Apps environment  (job host)
#   3. The job: manual trigger, system-assigned identity     (REQ3.1, REQ3.2)
#   4. Role assignments: Storage Blob Data Contributor on the storage
#      account, AcrPull on the registry                      (AC3.4)
#   5. Action group (email) + alert on failed executions     (REQ3.7)
#
# Idempotent where az allows it: re-running updates in place.
set -euo pipefail

# ---- names (confirmed 2026-09-29 unless marked) ------------------------------
SUBSCRIPTION="${SUBSCRIPTION:-Azure subscription 1}"
RG="tsi-data-dashboard"
LOCATION="canadacentral"
STORAGE_ACCOUNT="tsidashboardblobstorage"
STORAGE_URL="https://${STORAGE_ACCOUNT}.blob.core.windows.net"
ACR_NAME="TSIcontainers"
SOURCES_CONTAINER="pipeline-sources"          # private; ND-GAIN ZIPs go under sources/ndgain/
LAW_NAME="tsi-dashboard-logs"
CAE_NAME="tsi-dashboard-env"
JOB_NAME="tsi-pipeline-refresh"
ALERT_EMAIL="${ALERT_EMAIL:?set ALERT_EMAIL to the client-owned address that receives failure alerts}"
ACTION_GROUP="tsi-pipeline-alerts"

az account set --subscription "$SUBSCRIPTION"

# The login server is not <name>.azurecr.io: domain-name-label scope adds a hash
# suffix (docs/docker.md). Ask Azure for it rather than building it.
ACR_LOGIN_SERVER=$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)
IMAGE="${IMAGE:-${ACR_LOGIN_SERVER}/tsi-pipeline:latest}"   # built by scripts/acr_build.sh
az extension add --name containerapp --upgrade --only-show-errors >/dev/null

echo "1/5 private sources container"
az storage container create --name "$SOURCES_CONTAINER" --account-name "$STORAGE_ACCOUNT" \
  --public-access off --auth-mode login --only-show-errors >/dev/null

echo "2/5 log analytics + container apps environment"
az monitor log-analytics workspace create -g "$RG" -n "$LAW_NAME" -l "$LOCATION" --only-show-errors >/dev/null
LAW_ID=$(az monitor log-analytics workspace show -g "$RG" -n "$LAW_NAME" --query customerId -o tsv)
LAW_KEY=$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n "$LAW_NAME" --query primarySharedKey -o tsv)
az containerapp env create -g "$RG" -n "$CAE_NAME" -l "$LOCATION" \
  --logs-workspace-id "$LAW_ID" --logs-workspace-key "$LAW_KEY" --only-show-errors >/dev/null
unset LAW_KEY

echo "3/5 job (manual trigger, managed identity, 3 hour ceiling for the slow UN SDG path)"
az containerapp job create -g "$RG" -n "$JOB_NAME" --environment "$CAE_NAME" \
  --trigger-type Manual --replica-timeout 10800 --replica-retry-limit 0 --parallelism 1 --replica-completion-count 1 \
  --image "$IMAGE" --registry-server "$ACR_LOGIN_SERVER" --registry-identity system \
  --cpu 1.0 --memory 2.0Gi --mi-system-assigned \
  --env-vars \
    "AZURE_STORAGE_ACCOUNT_URL=$STORAGE_URL" \
    "NDGAIN_BLOB_CONTAINER=$SOURCES_CONTAINER" \
    "NDGAIN_BLOB_PREFIX=sources/ndgain/" \
    "PIPELINE_FETCH_RAW=true" \
    "PIPELINE_UPLOAD_AZURE=true" \
    "PIPELINE_PUBLISH_DASHBOARD=true" \
    "PIPELINE_RUN_FORECASTS=false" \
  --only-show-errors >/dev/null
PRINCIPAL_ID=$(az containerapp job show -g "$RG" -n "$JOB_NAME" --query identity.principalId -o tsv)

echo "4/5 least-privilege roles for the job identity"
STORAGE_ID=$(az storage account show -g "$RG" -n "$STORAGE_ACCOUNT" --query id -o tsv)
ACR_ID=$(az acr show -n "$ACR_NAME" --query id -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" --scope "$STORAGE_ID" --only-show-errors >/dev/null
az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "AcrPull" --scope "$ACR_ID" --only-show-errors >/dev/null

echo "5/5 failure alert to $ALERT_EMAIL"
az monitor action-group create -g "$RG" -n "$ACTION_GROUP" --short-name tsipipe \
  --action email client "$ALERT_EMAIL" --only-show-errors >/dev/null
AG_ID=$(az monitor action-group show -g "$RG" -n "$ACTION_GROUP" --query id -o tsv)
JOB_ID=$(az containerapp job show -g "$RG" -n "$JOB_NAME" --query id -o tsv)
# Metric: Container Apps Jobs emit JobExecutionCount with an ExecutionStatus
# dimension. VERIFY the dimension name in the portal (Metrics blade on the job)
# the first time; adjust --dimension if it differs.
az monitor metrics alert create -g "$RG" -n "${JOB_NAME}-failed" --scopes "$JOB_ID" \
  --condition "total JobExecutionCount > 0 where ExecutionStatus includes Failed" \
  --window-size 15m --evaluation-frequency 5m --severity 2 --action "$AG_ID" \
  --description "A pipeline refresh execution failed. Open the job, Execution history, read the last log line (PIPELINE RUN FAILED: ...)." \
  --only-show-errors >/dev/null

cat <<MSG

Done. Next:
  * Upload the current ND-GAIN ZIP to ${STORAGE_ACCOUNT}/${SOURCES_CONTAINER}/sources/ndgain/
  * Start the job once from the portal and confirm the last log line reads
    PIPELINE RUN COMPLETE: published v1 snapshot ...
  * Take the playbook screenshots (docs/playbook/README.md lists them)
MSG
