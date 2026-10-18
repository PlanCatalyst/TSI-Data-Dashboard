# Docker & Azure Container Registry

How the Python data pipeline is containerized and published to Azure Container
Registry (ACR). This covers the **backend pipeline only** (`src/`); the React
frontend in `dashboard/` is built and deployed separately.

## What's in the image

The image packages the batch pipeline (`fetch → raw store → clean → score/aggregate →
validate → upload → publish`, with forecasts off by default) and runs it via the same
entrypoint you'd use locally:

```
python -m src.pipeline.run_pipeline
```

| File | Purpose |
| --- | --- |
| [`Dockerfile`](../Dockerfile) | `python:3.11-slim` base, installs `requirements.txt`, copies production pipeline, projection, and taxonomy code, and runs as non-root `appuser`. |
| [`.dockerignore`](../.dockerignore) | Keeps the build context small and secret-free — excludes `data/` (~240 MB), `.env`, `.venv`, `dashboard/`, notebooks. |
| [`scripts/acr_build.sh`](../scripts/acr_build.sh) | One command to cloud-build in ACR and push `:latest` + `:<git-sha>`. |

### Design notes

- **Only `src/`, the production files from `projections/`, and `indicators/`
  are copied in.** Research notebooks and sample forecast output remain
  excluded. Paths in the code resolve
  relative to the repo root (`REPO_ROOT = Path(__file__).resolve().parents[2]`),
  which is `/app` in the image — so `indicators/indicators.yaml`,
  `country_codes.csv`, and `src/config/settings.yaml` all resolve correctly.
- **No `data/` in the image.** Local artifacts are regenerated at runtime (or
  mounted). The container writes to `/app/data/`, owned by `appuser`.
- **Secrets are never baked in.** `AZURE_*` / `ACR_*` are injected at runtime
  via env vars. `.env` is in `.dockerignore` and `.gitignore`.
- **Deps need no build toolchain.** `pandas`, `numpy`, `openpyxl`, and the
  `azure-*` libs all ship manylinux/pure-python wheels, so the slim base is
  enough — no `apt-get build-essential`.

## The registry

The registry **already exists** (name in `ACR_NAME`, set in `.env` and in
`infra/container-apps-job.sh`).

Its login server carries a hash suffix because **Domain name label
scope** is enabled — a newer ACR feature that makes the public hostname
tenant-unique. So the login server is **not** just the registry name plus the default Azure registry domain. Always use
`ACR_LOGIN_SERVER` (not `ACR_NAME`) when constructing image references for
`docker pull`; the registry *name* (`ACR_NAME`) is what `az acr` commands
take via `--registry` / `--name`.

Relevant `.env` values (set both to your registry's values):

```
ACR_NAME=<registry-name>
ACR_LOGIN_SERVER=<registry-login-server>
```

### Permissions

The publish service principal in `.env` is **Storage-only** by design (it publishes
JSON to Blob), so it has no rights on the registry. Two paths use the registry:

- **Running the job:** the Container Apps Job
  (defined in `infra/container-apps-job.sh`) pulls the image with its own system-assigned managed
  identity, which the script grants `AcrPull` on the registry. No registry credentials are
  stored.
- **Building the image:** `az acr build` runs a server-side ACR *Task*, which requires
  `Microsoft.ContainerRegistry/registries/scheduleRun/action`. That action is in the
  **Contributor** role, **not** in the data-plane `AcrPush` role (which only enables a local
  `docker push`). So whoever runs `scripts/acr_build.sh` needs Contributor scoped to the
  registry. Granting it needs `Microsoft.Authorization/roleAssignments/write`, i.e. **Owner**
  or **User Access Administrator**; plain Contributor cannot assign roles.

```zsh
# Run as an Owner / User Access Administrator, for the identity that will run builds
ACR_ID=$(az acr show -n "$ACR_NAME" --query id -o tsv)
az role assignment create --assignee <build-identity-object-id>   --scope "$ACR_ID" --role Contributor
```

**Alternative without an Owner:** enable the registry admin user
(`az acr update -n "$ACR_NAME" --admin-enabled true`, needs registry
Contributor) and switch to a *local* `docker build` + `docker push` using the
admin username/password. This sidesteps RBAC but uses a shared static
credential and still can't do `az acr build`.

> `.env` must stay sourceable: quote values with spaces and avoid inline `#` comments on a `KEY=value` line; `source` does
> not strip them.

## Build & push

`scripts/acr_build.sh` builds **server-side** with `az acr build` — no local
Docker daemon required. ACR uploads the build context, builds remotely, and
pushes. It reuses a valid `az` session or falls back to the `.env` service
principal for non-interactive runs.

```zsh
scripts/acr_build.sh            # tags :latest and :<git-sha>
scripts/acr_build.sh v1.2.0     # tags :v1.2.0 and :<git-sha>
```

Verify the push:

```zsh
az acr repository show-tags -n "$ACR_NAME" --repository tsi-pipeline -o table
```

### Local build (alternative)

Only if you need to build/run on your own machine (requires Docker Desktop):

```zsh
docker build -t tsi-pipeline:dev .
docker run --rm --env-file .env tsi-pipeline:dev          # full pipeline
docker run --rm --env-file .env tsi-pipeline:dev \
  python -m src.calculating.pipeline                       # single stage (CMD override)
```

## Running the image

The default entrypoint runs the whole pipeline; override the command to run a
single stage. Behaviour is governed by `src/config/settings.yaml` — notably:

- `runtime.fetch_raw` — set `true` to fetch fresh upstream data inside the
  container (UN SDG is slow/rate-limited; default `false` reuses `data/raw/`).
- `runtime.upload_azure` - governs the Azure upload and live publish. Override per run with the
  `PIPELINE_UPLOAD_AZURE` env var (the job sets its own overrides in
  `infra/container-apps-job.sh`).

Provide Azure credentials at runtime via `--env-file .env` (local). On the execution host, the
Azure Container Apps Job authenticates with its managed identity (`infra/container-apps-job.sh`).

## Status & open items

- ✅ Dockerfile, `.dockerignore`, and `acr_build.sh` are in place.
- ✅ Registry exists (`ACR_NAME`).
- ✅ Execution host chosen: Azure Container Apps Job, defined in
  `infra/container-apps-job.sh` (manual trigger, 3h timeout, failure email alert,
  managed identity with AcrPull and Storage Blob Data Contributor). **Coded, not yet
  provisioned.** `scripts/acr_build.sh` produces the image the job runs. There is no cron;
  the six-month cadence is a human routine (`docs/runbook-refresh.md`).
- ⏳ Build identity: whoever runs `scripts/acr_build.sh` needs Contributor on the registry
  (see Permissions above); not yet granted for the provisioning step.
- ✅ ACR login server verified 2026-10-17 (`az acr show -n "$ACR_NAME" --query loginServer`);
  the value goes in `ACR_LOGIN_SERVER`. `infra/container-apps-job.sh` now reads it from
  Azure instead of deriving it from the registry name.
