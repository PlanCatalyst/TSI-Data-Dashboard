# Runbook: data refresh (engineer path)

**Routine six-month refresh:** PlanCatalyst staff run it from the Azure portal
using the playbook in `docs/playbook/`. No terminal. This runbook covers only
what the playbook does not: provisioning the job, running the pipeline from a
laptop, rollback by hand, forecast publish, and frontend deploys.

The pipeline prints one of these as its last line, and the Container Apps Job
reports the matching exit code:

```
PIPELINE RUN COMPLETE: published v1 snapshot <run id>, <n> countries
PIPELINE RUN COMPLETE: dry run, snapshot <run id> written locally, <n> countries
PIPELINE RUN FAILED: <stage> <reason>; previous /v1/ snapshot unchanged
```

---

## What updates what

| You changed | What to run | Does the live site change? |
|---|---|---|
| Indicator data | The pipeline (job or local), publishing to Blob | Yes, on the next page load. No frontend deploy. |
| Frontend code or copy | `npm run build` plus an SWA deploy | Yes, after the deploy completes. |
| The Blob account or container URL | Both, in that order | Yes, but the frontend rebuild is mandatory. |

The React app fetches `meta.json`, `countries.json` and `timeseries.json` from
Blob at runtime. The Blob URL is compiled in from `VITE_CONTRACT_BASE_URL`, so
changing the location needs a rebuild; refreshing the data does not.

---

## The Azure job (client-operable refresh)

`infra/container-apps-job.sh` provisions everything in resource group
`tsi-data-dashboard`: a private `pipeline-sources` container for ND-GAIN
uploads, a Container Apps environment, the manual job `tsi-pipeline-refresh`
with a system-assigned identity, the two role assignments (Storage Blob Data
Contributor on the storage account, AcrPull on `TSIcontainers`), and an email
alert on failed executions. Review the variables, export `ALERT_EMAIL`, run it
once from an `az login` session with rights to assign roles.

The job runs the image built by `scripts/acr_build.sh` with these environment
variables, which override `settings.yaml` at run time:

| Variable | Job value | Effect |
|---|---|---|
| `AZURE_STORAGE_ACCOUNT_URL` | the account URL | Enables Azure; identity comes from the default credential chain |
| `NDGAIN_BLOB_CONTAINER` / `NDGAIN_BLOB_PREFIX` | `pipeline-sources` / `sources/ndgain/` | Newest `.zip` under the prefix is used and logged as `ND-GAIN source:` |
| `PIPELINE_FETCH_RAW` | `true` | Live fetch of UN SDG, World Bank, UNDP, WGI |
| `PIPELINE_UPLOAD_AZURE` / `PIPELINE_PUBLISH_DASHBOARD` | `true` | Validated CSVs to `validated-scores`, contract JSON to `dashboard-public/v1` |
| `PIPELINE_RUN_FORECASTS` | `false` | Historical only |

No secret is stored anywhere in the job. Locally, the same variables can be
exported to reproduce a job run; with the `AZURE_*` service principal triple in
`.env` the pipeline uses it instead of the managed identity.

---

## Running the pipeline from a laptop

1. `.env` at the repo root with `AZURE_STORAGE_ACCOUNT_URL` and, for the
   service principal path, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
   `AZURE_CLIENT_SECRET`. The principal `tsidashboard-pipeline` holds Storage
   Blob Data Contributor on `dashboard-public` only; its secret expires
   **2027-09-28**. Never commit `.env`.
2. `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
3. A clean git tree, so the refreshed fixtures diff is readable.
4. Run, with the toggles as environment variables rather than edits to
   `settings.yaml`:

   ```zsh
   PIPELINE_FETCH_RAW=true PIPELINE_UPLOAD_AZURE=true python3 -m src.pipeline.run_pipeline
   ```

   Leave `PIPELINE_UPLOAD_AZURE` unset for a dry run into `data/organized/v1/`.
5. The run stops itself on a blocking data quality finding (stage
   "data validation"). Read `data/interim/validated/data_quality_report.md`,
   log the defect in `docs/data-quality-issues.md`, fix the cause, rerun. To
   run the rules alone against existing scored outputs:

   ```zsh
   python3 -m src.validation
   python3 scripts/clamp_audit.py
   ```

   Anything with a high pinned share is the benchmark clamp at work (see
   `indicators/SCORING_AUDIT.md`), not a bug, but a pillar collapsing to a
   single value is. Do not publish a pillar you know is meaningless.
6. Verify the live endpoint and the console:

   ```zsh
   curl -s https://tsidashboardblobstorage.blob.core.windows.net/dashboard-public/v1/meta.json | head -c 200
   ```

   `generatedAt` and `pipelineRunId` must match the completion line. The site
   should log `Loading contract from Azure`, not the local `/v1` fallback.
7. Commit the refreshed `dashboard/public/v1/` fixtures and the regenerated
   clamp audit section. Note the run id in `HANDOFF.md`.

---

## Rollback

Publishing overwrites `/v1/` in place. Keep a dated copy before every live
publish:

```zsh
mkdir -p backups/v1-$(date +%Y%m%d)
for f in meta.json countries.json timeseries.json projections.json; do
  curl -s "https://tsidashboardblobstorage.blob.core.windows.net/dashboard-public/v1/$f" \
    -o "backups/v1-$(date +%Y%m%d)/$f" || true
done
```

To roll back, re-upload the payload files, then `meta.json` **last** (same
atomic order as publish). The playbook section 6 describes the same steps
through the portal for staff. A contract-breaking change bumps the path to
`/v2/` instead: `docs/data-contract.md` first, then the publisher, then the
frontend.

---

## Scoring rule switch

`scoring.below_benchmark` in `settings.yaml` selects `clamp` (v1) or
`soft_floor` (requirements v2 option B). Changing it changes every score:
bump `index_version`, record it in `docs/data-contract.md` and
`indicators/SCORING_AUDIT.md`, run `scripts/clamp_audit.py --write-audit`,
then publish. Awaiting the client decision.

---

## Forecast publish (manual only)

Projections are off by default and never scheduled. Set
`PIPELINE_RUN_FORECASTS=true` for one run; the orchestrator emits section 8
rows before publish, `publish_dashboard` validates them, writes
`projections.json`, and flips `meta.projections.enabled`. Contract authority:
`docs/data-contract.md` section 8. Unavailable copy is the single string
`UX_UNAVAILABLE_COPY`; do not add dashboard strings. When projections are
disabled the frontend shows nothing about them (requirements v2, A6).

Atomic order with forecasts: `countries.json`, `timeseries.json`,
`projections.json`, then `meta.json`.

---

## Frontend deploy (code changes only)

CI runs on every push: backend tests, dependency audits, the design token
guardrail (`npm run lint:tokens`), the frontend build, the container build and
CodeQL. Production deploys are intentional: dispatch **Deploy dashboard** from
`main`.

```zsh
gh workflow run deploy-dashboard.yml --ref main
gh run watch <run-id> --compact --exit-status
```

Static Web App `tsi-dashboard-frontend`, resource group `tsi-data-dashboard`,
subscription "Azure subscription 1" (PlanCatalyst), public host
`jolly-pebble-0e2f9300f.7.azurestaticapps.net`. If the deploy fails with
`deployment_token was not provided`, re-set the environment secret without the
value touching a terminal or a file:

```zsh
az staticwebapp secrets list --name tsi-dashboard-frontend \
  --resource-group tsi-data-dashboard --query "properties.apiKey" -o tsv \
  | tr -d '\n' | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --env production
gh run rerun <run-id> --failed
```

`dashboard/public/staticwebapp.config.json` controls who may frame the
dashboard (`plancatalyst.org`, `*.plancatalyst.org`, Wix editor and preview).

---

## Related

- `docs/playbook/` - the staff-facing refresh document and its screenshots
- `infra/container-apps-job.sh` - job provisioning, roles, alert
- `docs/requirements-v2.md` - the v2 scope this runbook serves
- `docs/data-contract.md` - payload schema; authority when anything disagrees
- `indicators/SCORING_AUDIT.md` - scoring direction, below-benchmark rule, clamp audit
- `HANDOFF.md` - project context and run history
