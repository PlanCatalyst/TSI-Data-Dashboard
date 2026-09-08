# Runbook: Semi-Annual Data Refresh

**Cadence:** twice a year (client-confirmed 2026-08-13).
**Duration:** 45 to 90 minutes, most of it unattended fetch time.
**Who can run it:** anyone with the service principal credentials and a Python 3.11+ environment.

This replaces the containerised scheduled pipeline, which was descoped 2026-09-04. At two runs a
year, a registry, an image build and a container host cost more than they save. The tradeoff is
that nothing fires on its own: someone has to remember. Put a recurring calendar reminder on it.

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
a data refresh needs no redeploy. The Blob URL itself is compiled in at build time from
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

`src/config/settings.yaml` ships with `runtime.fetch_raw: false` so day-to-day work reuses cached
payloads. A real refresh needs it on:

```yaml
runtime:
  fetch_raw: true       # set back to false when finished
  upload_azure: true
  publish_dashboard: true
```

UN SDG is slow and rate-limited. Expect the fetch stage to dominate the runtime. Set `fetch_raw`
back to `false` afterwards so nobody re-fetches by accident.

### 2. Run the pipeline

```zsh
python3 -m src.pipeline.run_pipeline
```

Fetch, clean, score, aggregate, upload validated CSVs, then publish the contract JSON.

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

- Set `runtime.fetch_raw` back to `false`.
- Commit the refreshed `dashboard/public/v1/` fixtures and any `SCORING_AUDIT.md` changes.
- Note the run date and `run-id` in `HANDOFF.md`.

---

## Rollback

Publishing overwrites `/v1/` in place, so there is no automatic previous version. Before step 5,
keep a copy:

```zsh
mkdir -p backups/v1-$(date +%Y%m%d)
curl -s https://<account>.blob.core.windows.net/dashboard-public/v1/meta.json \
  -o backups/v1-$(date +%Y%m%d)/meta.json
# repeat for countries.json and timeseries.json
```

To roll back, re-upload those three files. If a contract-breaking change is ever needed, bump the
path to `/v2/` rather than overwriting `/v1/`, update `docs/data-contract.md` first, then the
publisher, then the frontend.

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

- `docs/data-contract.md` — payload schema, the authority when anything disagrees
- `indicators/SCORING_AUDIT.md` — scoring direction, per-indicator status, closed issues
- `docs/docker.md` — the containerised path, retained in case the cadence ever shortens
- `HANDOFF.md` — project context and run history
