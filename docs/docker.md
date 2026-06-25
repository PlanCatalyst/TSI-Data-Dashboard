# Docker & Azure Container Registry

How the Python data pipeline is containerized and published to Azure Container
Registry (ACR). This covers the **backend pipeline only** (`src/`); the React
frontend in `dashboard/` is built and deployed separately.

## What's in the image

The image packages the batch pipeline — `fetch → clean → score/aggregate →
upload` — and runs it via the same entrypoint you'd use locally:

```
python -m src.pipeline.run_pipeline
```

| File | Purpose |
| --- | --- |
| [`Dockerfile`](../Dockerfile) | `python:3.10-slim` base, installs `requirements.txt`, copies `src/` + `indicators/`, runs as non-root `appuser`. |
| [`.dockerignore`](../.dockerignore) | Keeps the build context small and secret-free — excludes `data/` (~240 MB), `.env`, `.venv`, `dashboard/`, notebooks. |
| [`scripts/acr_build.sh`](../scripts/acr_build.sh) | One command to cloud-build in ACR and push `:latest` + `:<git-sha>`. |

### Design notes

- **Only `src/` and `indicators/` are copied in.** Paths in the code resolve
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

The registry **already exists** — `TSIcontainers`, in resource group
`tsi-data-dashboard`, Canada Central.

Its login server carries a hash suffix
(`tsicontainers-ftd4exffe0b2h4e7.azurecr.io`) because **Domain name label
scope** is enabled — a newer ACR feature that makes the public hostname
tenant-unique. So the login server is **not** `<name>.azurecr.io`. Always use
`ACR_LOGIN_SERVER` (not `ACR_NAME`) when constructing image references for
`docker pull`; the registry *name* (`TSIcontainers`) is what `az acr` commands
take via `--registry` / `--name`.

Relevant `.env` values:

```
ACR_NAME=TSIcontainers
ACR_LOGIN_SERVER=tsicontainers-ftd4exffe0b2h4e7.azurecr.io
RESOURCE_GROUP=tsi-data-dashboard
LOCATION="Canada Central"
```

### One-time permission grant — **needs an Owner / User Access Administrator**

The service principal in `.env` is **Storage-only** by design (it publishes JSON
to Blob) — it has no rights on the registry, so it can't push. The push identity
needs **Contributor scoped to the registry**, not just `AcrPush`:

> `az acr build` runs a server-side ACR *Task*, which requires
> `Microsoft.ContainerRegistry/registries/scheduleRun/action`. That action is in
> the **Contributor** role, **not** in the data-plane `AcrPush` role. `AcrPush`
> only enables a local `docker push`. So for cloud build, grant **Contributor**.

This grant requires `Microsoft.Authorization/roleAssignments/write` — i.e.
**Owner** or **User Access Administrator** on the registry/RG/subscription.
Plain Contributor (and "Container Apps Contributor") **cannot** assign roles.

```zsh
# Run as an Owner / User Access Administrator
ACR_ID=$(az acr show -n TSIcontainers --query id -o tsv)

# Option A — grant the service principal (best for headless CI / the build script)
az role assignment create \
  --assignee 023cbca7-ef83-4b53-b615-fc9377295932 \
  --scope "$ACR_ID" --role Contributor

# Option B — grant a human who will run builds interactively
az role assignment create \
  --assignee anthony.lam@plancatalyst.org \
  --scope "$ACR_ID" --role Contributor
```

**Alternative without an Owner:** enable the registry admin user
(`az acr update -n TSIcontainers --admin-enabled true`, needs registry
Contributor) and switch to a *local* `docker build` + `docker push` using the
admin username/password. This sidesteps RBAC but uses a shared static
credential and still can't do `az acr build`.

> `.env` must stay sourceable: quote values with spaces (`LOCATION="Canada
> Central"`) and avoid inline `#` comments on a `KEY=value` line — `source` does
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
az acr repository show-tags -n TSIcontainers --repository tsi-pipeline -o table
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
- `runtime.upload_azure` — set `true` to push validated CSVs to Blob.

Provide Azure credentials at runtime via `--env-file .env` (local) or
environment variables on the execution host (e.g. Azure Container Instances).

## Status & open items

- ✅ Dockerfile, `.dockerignore`, and `acr_build.sh` are in place.
- ✅ Registry `TSIcontainers` exists (Canada Central, `tsi-data-dashboard`).
- ⏳ `AcrPush` grant to the storage-only service principal — owner: **Anthony**
  (Azure). Until then the build script can't push.
- 🔭 Execution host (ACI / scheduled job) is not chosen yet; the image is built
  to be CMD-overridable and run anywhere. See `CLAUDE.md` for the publish-step
  wiring that still runs as a manual post-step.
