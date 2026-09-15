# Runbook: Semi-Annual Data Refresh

**Cadence:** twice a year (client-confirmed 2026-08-13).
**Duration:** 45 to 90 minutes, most of it unattended fetch time.
**Who can run it:** anyone with the service principal credentials and a Python 3.11+ environment.

This replaces the containerised scheduled pipeline, which was descoped 2026-09-04. At two runs a
year, a registry, an image build and a container host cost more than they save. The tradeoff is
that nothing fires on its own: someone has to remember. Put a recurring calendar reminder on it.
Forecast / projections publish follows the same rule — **manual only**, no ACR/ACI cron (see
Forecast publish below).

---

## What updates what

The dashboard and its data deploy on two independent paths. Confusing them is the most likely
mistake in this runbook.

| You changed | What to run | Does the live site change? |
|---|---|---|
| Indicator data | The pipeline, publishing to Blob (below) | Yes, on the next page load. No frontend deploy. |
| Frontend code or copy | `npm run build` plus an SWA deploy | Yes, after the deploy completes. |
| The Blob account or container URL | Both, in that order | Yes, but the frontend rebuild is mandatory. |

The React app fetches `meta.json`, `countries.json` and `timeseries.json` from Blob at runtime, so
a data refresh needs no redeploy. When `meta.projections.enabled` is true it also fetches
`projections.json` (see `docs/data-contract.md` §8); when disabled it stays on the historical-only
path and does not require that file. The Blob URL itself is compiled in at build time from
`VITE_CONTRACT_BASE_URL`, so changing the *location* does need a rebuild.

---

## Prerequisites

1. **Credentials.** A `.env` at the repo root, gitignored, never committed:

   ```
   AZURE_TENANT_ID=...
   AZURE_CLIENT_ID=...
   AZURE_CLIENT_SECRET=...
   AZURE_STORAGE_ACCOUNT_URL=https://<account>.blob.core.windows.net
   ```

   The service principal needs exactly one role: **Storage Blob Data Contributor**, scoped to the
   `dashboard-public` container. Not the storage account, not the subscription. It must not be able
   to reach the private `validated-scores` container, which holds intermediate artifacts the
   dashboard never reads.

2. **Python environment.**

   ```zsh
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **A clean git tree.** Commit or stash first. A refresh rewrites
   `data/interim/validated/` and `dashboard/public/v1/`, and you want the diff to be readable.

---

## Procedure

### 1. Enable a fresh fetch

`src/config/settings.yaml` ships with `runtime.fetch_raw: false` (and `runtime.run_forecasts:
false`) so day-to-day work reuses cached payloads and skips the forecast emit. A real refresh
needs the publish path on; a forecast publish also needs `run_forecasts`:

```yaml
runtime:
  fetch_raw: true          # set back to false when finished
  upload_azure: true
  publish_dashboard: true
  run_forecasts: false     # true only for a forecast publish (see Forecast publish below)
```

These are the only runtime toggles that gate the path — there is **no** `settings.yaml` key for
`meta.projections.enabled`. That field is written by `publish_dashboard` when §8 rows are present
(see below). Optional: `runtime.forecast_horizon_years` (default `5`).

UN SDG is slow and rate-limited. Expect the fetch stage to dominate the runtime. Set `fetch_raw`
(and `run_forecasts`, if you flipped it) back to `false` afterwards so nobody re-fetches or
re-forecasts by accident.

### 2. Run the pipeline

```zsh
python3 -m src.pipeline.run_pipeline
```

Fetch, clean, score, aggregate, upload validated CSVs, optionally emit World Bank forecasts
(`runtime.run_forecasts`), then publish the contract JSON. Publish order is always payloads first,
`meta.json` last (see Forecast publish).

### 3. Sanity-check the scores before they go anywhere

```zsh
ls data/interim/validated/indicatorscores/ | wc -l     # expect 28
```

Then check that no indicator has collapsed to a single value, which is the failure mode that
produced issues #3, #4 and #5:

```zsh
python3 - <<'PY'
import pandas as pd, pathlib
for f in sorted(pathlib.Path('data/interim/validated/indicatorscores').glob('*.csv')):
    d = pd.read_csv(f)
    col = next((c for c in d.columns if 'score' in c.lower()), None)
    if not col: continue
    s = d[col].dropna()
    flag = '  <-- CHECK' if len(s) and (s.nunique() < 3 or (s == s.max()).mean() > 0.8) else ''
    print(f'{f.stem:10s} rows={len(d):6d} countries={d.iloc[:,0].nunique():4d} '
          f'unique={s.nunique():4d} pct_at_max={((s==s.max()).mean()*100 if len(s) else 0):5.1f}{flag}')
PY
```

Anything flagged is saturating. Investigate before publishing; do not publish a pillar you know is
meaningless.

### 4. Dry-run the publish

```zsh
python3 -m src.upload.publish_dashboard
```

Writes to `data/organized/v1/` instead of Blob and runs the same `validate_payload` gate. If
validation raises, stop. Fix the data, do not weaken the validator.

### 5. Publish for real

```zsh
python3 -m src.upload.publish_dashboard --azure --run-id refresh-$(date +%Y%m%d)
```

Validation gates the upload. If it fails, nothing is written and the previous `/v1/` snapshot stays
live. There is no partial publish.

### 6. Verify against the live endpoint

```zsh
curl -s https://<account>.blob.core.windows.net/dashboard-public/v1/meta.json | head -c 200
```

Confirm `generatedAt` and `pipelineRunId` match the run you just did. Then load the SWA URL, open
the browser console, and confirm it logs `Loading contract from Azure` rather than
`falling back to local /v1`. The fallback is silent by design, so the console is the only place a
misconfigured build announces itself.

### 7. Reset and record

- Set `runtime.fetch_raw` (and `runtime.run_forecasts`, if used) back to `false`.
- Commit the refreshed `dashboard/public/v1/` fixtures and any `SCORING_AUDIT.md` changes.
- Note the run date and `run-id` in `HANDOFF.md`.

---

## Rollback

Publishing overwrites `/v1/` in place, so there is no automatic previous version. Before step 5,
keep a copy:

```zsh
mkdir -p backups/v1-$(date +%Y%m%d)
for f in meta.json countries.json timeseries.json projections.json; do
  curl -s "https://<account>.blob.core.windows.net/dashboard-public/v1/$f" \
    -o "backups/v1-$(date +%Y%m%d)/$f" || true
done
```

To roll back, re-upload the payload files you backed up, then `meta.json` **last** (same atomic
order as publish). If the previous snapshot had projections disabled, restoring an older
`meta.json` with `projections.enabled: false` is enough for the frontend to stop fetching
`projections.json`. If a contract-breaking change is ever needed, bump the path to `/v2/` rather
than overwriting `/v1/`, update `docs/data-contract.md` first, then the publisher, then the
frontend.

---

## Forecast publish (Reyna — manual only)

Projections are **not** on a schedule. Same thesis as the rest of this runbook: no ACR image
build, no ACI/container cron, no GitHub Actions timer. Someone flips flags, runs the path by
hand, verifies the live site, and flips flags off. Put a calendar reminder next to the
semi-annual refresh if PlanCatalyst wants forecasts refreshed on the same cadence.

Contract authority: `docs/data-contract.md` §8. Machine gate codes live in
`src.projections.quality_gates.GATE_REASONS`. User-facing unavailable copy is the single shared
string `UX_UNAVAILABLE_COPY` — **do not invent new dashboard strings**:

> Forecast unavailable due to insufficient information.

When projections are still disabled, the meta note stays exactly:

> Projection band coming soon.

### Flags (as implemented)

In `src/config/settings.yaml` → `runtime:`:

| Key | Role |
|---|---|
| `run_forecasts` | Orchestrator runs `projections.process_data.ProcessData` before publish (default `false`). |
| `fetch_raw` | Fresh upstream pull (usually leave `false` if World Bank interim CSV is already current). |
| `upload_azure` | Live Blob upload for validated CSVs **and** (with creds) for `publish_dashboard`. |
| `publish_dashboard` | Build/upload contract JSON after scoring (default `true`). |

`meta.projections.enabled` is **not** a settings key. `build_meta` always starts with
`enabled: false` and note `"Projection band coming soon."`. When
`data/processed/worldbank/forecasts/world_bank_forecasts.csv` exists, `publish_dashboard` loads
those §8 rows, validates them with `src.projections.validate_payload`, writes `projections.json`,
and `apply_projections_meta` flips `meta.projections.enabled` to `true` (note copy is left
unchanged). Delete or move that CSV (or pass `include_projections=False` in code) if you need a
historical-only publish.

### Path A — full pipeline (recommended)

```yaml
runtime:
  fetch_raw: false          # or true if you also need a data refresh
  upload_azure: true
  publish_dashboard: true
  run_forecasts: true       # ProcessData → data/processed/.../world_bank_forecasts.csv
```

```zsh
python3 -m src.pipeline.run_pipeline
```

Order inside the orchestrator: fetch → clean → score → upload validated → **ProcessData
(forecasts)** → publish.

### Path B — forecast emit, then publish only

Use when scored/interim World Bank data is already on disk and you only need to re-emit and
republish projections:

```zsh
python3 - <<'PY'
from pathlib import Path
from projections.process_data import ProcessData
ProcessData(Path("src/config/settings.yaml")).process()
PY

python3 -m src.upload.publish_dashboard
# then, when dry-run looks good:
python3 -m src.upload.publish_dashboard --azure --run-id forecast-$(date +%Y%m%d)
```

`ProcessData` writes `data/processed/worldbank/forecasts/world_bank_forecasts.csv` (and actuals).
Publish picks that file up automatically.

### Atomic publish order

Payload files first; **`meta.json` last** (readiness marker). With forecasts present the order is:

1. `countries.json`
2. `timeseries.json`
3. `projections.json`
4. `meta.json` **LAST**

Implemented by `upload_payloads_then_meta` in `src/upload/publish_dashboard.py`. A mid-payload
failure never writes meta, so the previous live snapshot stays marked ready. Dry-run mirrors the
same order under `data/organized/v1/`.

### Verify the dashboard

1. **Live meta:** `curl` `.../v1/meta.json` and confirm `projections.enabled` is `true` and
   `firstProjectedYear` is set when you intended a forecast publish; when you intended disabled,
   `enabled` is `false` and `note` is still `Projection band coming soon.`
2. **Bands when forecast:** open the SWA map detail / indicator trend for a series with
   `status: "forecast"` rows — interval band (`value_lo` / `value_hi`) should render.
3. **Unavailable copy:** for `status: "unavailable"` rows the UI must show exactly
   `Forecast unavailable due to insufficient information.` (from `UX_UNAVAILABLE_COPY` /
   `GATE_REASONS` — no per-reason user strings).
4. **Disabled path:** with `meta.projections.enabled === false`, About / detail still surfaces
   the meta note `Projection band coming soon.` and the app does not fetch `projections.json`.
5. Console should log `Loading contract from Azure` (not the local `/v1` fallback).

### Afterward

- Set `runtime.run_forecasts` (and `fetch_raw`, if used) back to `false`.
- Note the `run-id` and whether projections were enabled in `HANDOFF.md`.

---

## Frontend deploy (only when code changes)

There is no CI in this repo. Builds and deploys are manual.

```zsh
cd dashboard
npm install
npm run build          # tsc -b && vite build
```

`dashboard/.env.production` supplies `VITE_CONTRACT_BASE_URL`. It is gitignored, so **a fresh clone
will not have it** and the build will silently fall back to the bundled fixtures in
`dashboard/public/v1/`. Recreate it from `dashboard/.env.example` before building. This is the
single most likely handoff failure.

Deploy `dashboard/dist/` to the Static Web App. The embed URL never changes, so the iframe on the
client's Wix page does not need to be touched after a deploy.

`dashboard/staticwebapp.config.json` controls who may frame the dashboard. `frame-ancestors`
currently allows `plancatalyst.org`, `*.plancatalyst.org` and the Wix editor and preview origins.
Adding a new host means editing that file and redeploying.

---

## Related

- `docs/data-contract.md` — payload schema (§8 = interval forecast rows); authority when anything disagrees
- `src/projections/quality_gates.py` — `GATE_REASONS` + `UX_UNAVAILABLE_COPY` (no new user-facing strings)
- `indicators/SCORING_AUDIT.md` — scoring direction, per-indicator status, closed issues
- `docs/docker.md` — the containerised path, retained in case the cadence ever shortens; **not** used for forecast scheduling
- `HANDOFF.md` — project context and run history
