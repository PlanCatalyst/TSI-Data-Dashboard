# Handoff and Execution Context — PlanCatalyst Data Dashboard

> Active onboarding and execution guide. Last updated **2026-10-17**.

## 0) Status, 2026-10-17 (core state as of 2026-09-29)

Three things define the current state:

1. **All 28 indicators score correctly.** Issues #3, #4, #5 and #6 were closed 2026-07-07. The
   "scoring bugs" block that used to live in section 4 is resolved and has been rewritten.
2. **The scoring and forecasting work is committed on `main`.** Forecast
   quality gates, ARIMA intervals, atomic projection publish, and the
   projection-aware frontend are merged and locally verified.
3. **The live Blob was republished 2026-09-29** (`pipelineRunId: refresh-20260929`) with the
   2026-07-07 scoring fixes, `mspi` in place of `hdi`, and the contract §3.1 `indicatorStatus`
   field. Credentials: the pipeline service principal (credentials in `.env`), Storage Blob Data
   Contributor on the public payload container only (`publish.dashboard_container_name` in
   `src/config/settings.yaml`), in the storage account named by `AZURE_STORAGE_ACCOUNT_URL`.
   The hosted frontend was redeployed the same evening and renders the status field.

**Operations:** the PlanCatalyst-operable refresh is coded as of 2026-10-14
(completion line, managed-identity credential, Blob-sourced ND-GAIN, env
overrides). The Azure Container Apps Job is defined in
`infra/container-apps-job.sh` (manual trigger, 3h timeout, failure email alert) but is
**not yet provisioned**. Refresh is manual either way; there is no cron. Staff procedure: `docs/playbook/`. Engineer path:
`docs/runbook-refresh.md`. Scope and status: `docs/requirements-v2.md`.

## 1) Project at a glance

PlanCatalyst needs a backend pipeline that publishes contract-valid dashboard
JSON and a frontend that consumes only those payloads.

The dashboard is a decision-support product for identifying country-level need.
It is not an impact attribution system.

## 2) System flow

```
fetch -> raw store -> clean -> score/aggregate -> validate (blocking) -> upload validated -> forecasts (off by default) -> publish contract JSON -> Azure Blob -> React frontend -> Wix iframe
```

Published contract files:

- `meta.json`
- `countries.json`
- `timeseries.json`
- `projections.json` (only on a forecast run; projections are off by default)

Contract source of truth: `docs/data-contract.md`

**Publish is now wired:** `orchestrator.py` calls `publish_dashboard` at the end of the run (`622e3bf`). The full chain - fetch → clean → score → upload → publish - executes in one command. Dry-run mode (`upload_azure: false`) writes JSON to `data/organized/v1/`; live mode (`upload_azure: true`) pushes to the public payload container under `publish.dashboard_prefix`.

## 3) Load-bearing invariants

1. Frontend-facing scores are `higher_is_better`.
2. `iso3` is canonical key across all contract files.
3. Missing observations stay `null`.
4. Contract-breaking changes require path/version bump (`/v1` → `/v2`).
5. Frontend does not read internal CSV artifacts directly.

## 4) Current known gaps

From `indicators/SCORING_AUDIT.md` and git history (as of 2026-07-04):

- ~~`gii`~~ — **Closed 2026-05-17** (`UNDPHDRFetcher`).
- ~~`mpi`~~ — **Closed 2026-05-17** (`UNDPHDRFetcher`).
- ~~`ndgain` composite~~ — **Closed 2026-05-17** (published `vulnerability.csv`).
- ~~`state`~~ — **Closed 2026-05-17** (WGI Government Effectiveness).
- ~~`conces`~~ — Replaced by `hdi` (2026-06-01), then by contract key **`mspi`**
  (2026-09-19) after the `mspi` spec arrived. Composer wired; taxonomy maps
  `mspi` → `MSPI_INDEX`. See `docs/spec-macrosec-index.md`. Scored 2026-09-19
  at 117 countries vs HDI 193; since 2026-09-24 non-covered
  countries are excluded rather than substituted, so `mspi` is cleared for the
  live snapshot.
- ~~Orchestrator → publish wiring~~ — **Closed 2026-07-03** (`622e3bf`). Full pipeline runs in one command.
- ~~`popdens` series_code missing~~ — **Closed** (`622e3bf`). WB cleaner now emits `EN.POP.DNST`.
- ~~`popdens` scorer formula saturating~~ - **Closed 2026-07-03** (`b19f1a8`). Banded 0/25/50/75/100 formula adopted from `indicators.yaml`. Display direction decision (2026-09-17): keep scored + inverted; dense countries display low.
- ~~Production `npm run build`~~ — **Closed** (`b88f74a`).
- ~~Frontend hosting~~ - **Closed 2026-07-03** (`08d96e1`). Deployed to Azure Static Web Apps.
- `VITE_CONTRACT_BASE_URL` — **set** in `dashboard/.env.production` and the Blob endpoint returns
  200. The file is gitignored, so a fresh clone silently falls back to bundled fixtures. See
  `docs/runbook-refresh.md`.
- ~~**Storage account ownership unconfirmed.**~~ **Resolved 2026-09-29:** the storage account is in
  PlanCatalyst's subscription, so no migration and no frontend rebuild for it. Account-level public
  blob access is disabled (HTTP 409 `PublicAccessNotPermitted`); only the public payload container
  is anonymous-readable.
- ~~**No `.env` at repo root.**~~ **Closed 2026-09-29.** The pipeline service principal exists;
  `.env` holds the four `AZURE_*` values locally and is gitignored. The service principal secret
  expires, so a refresh after its expiry needs a rotated secret.
- ~~Stale `data/clean/unsdg/un_sdg_clean.csv` (M49 codes vs ISO3)~~ — **Closed 2026-09-24.**
  Verified: 234 distinct country codes on disk, all ISO3, none numeric.
- ~~Stale local fixtures `dashboard/public/v1/` (May 17)~~ - **Regenerated 2026-10-15.**
- ~~ACR push rights blocked~~ - **Superseded.** The 2026-09-04 descope of containerised refresh was
  reversed: the pipeline image (`scripts/acr_build.sh`) now feeds the manual Container Apps Job in
  `infra/container-apps-job.sh` (managed identity with AcrPull). Coded, not yet provisioned. Open
  item: ACR login server naming differs between `docs/docker.md` and the scripts.
- Frontend presentability / mock parity: open.

**✅ Scoring bugs from the 2026-06-28 output: all closed 2026-07-07 (GitHub issues #3–#6).**
Verified again 2026-09-04 against `data/interim/validated/`.
- `agoda` (#3) — **Fixed.** `GoalRatioScorer(goal=0.02)` now applied after normalising raw
  USD-millions to ag-flow/GDP. 152 countries, 0% of rows at 100. Previously pinned the `ag` pillar
  to 100 for 182/216.
- `susag` (#4) — **Fixed.** `SimpleDirectionalScorer` on the 0–100 proportion scale, replacing a
  scorer built for a 1–5 band. Scores now vary; sparse coverage (~10 countries) is inherent to the
  source, not a defect.
- `clean` (#5) — **Fixed.** `EG_EGY_CLEAN` rows were absent from a stale on-disk snapshot. Re-fetch
  and clean restored 8,730 rows across 194 countries. `clean.csv` is produced. 28/28 indicators
  reach scoring.
- `popdens` (#6) — **Verified.** The banded fix produces 0/25/50/75/100 in a fresh run.
- **Live as of 2026-09-29** (`refresh-20260929`). The pre-fix snapshot lag is closed.

- Automation / alerting - **coded, not provisioned.** `infra/container-apps-job.sh` defines the
  manual-trigger job and a failure email alert. No cron or scheduler exists; the six-month cadence
  is a human routine (`docs/runbook-refresh.md`).

## 5) Legacy output policy

`domainscores.csv`, `sectorscores.csv`, `subsectorscores.csv` are compatibility
outputs from the legacy 3-level hierarchy. They are not required by the new
frontend contract.

Default policy: keep transitionally, gate with configuration, remove when unused.

## 6) Azure and deployment expectations

- Private container for backend artifacts (`azure.container_name` in `src/config/settings.yaml`). The pipeline's `upload_validated`
  stage writes there, but the publish service principal has rights on the public payload container only
  (see `docs/CLAUDE-reference.md`), so a run with `upload_azure` on would fail that stage unless a second
  scoped role is granted; the Container Apps Job uses its own managed identity
- Private container for ND-GAIN ZIPs (`NDGAIN_BLOB_CONTAINER`, set in `infra/container-apps-job.sh`)
- Public-read container for frontend payloads (`publish.dashboard_container_name`)
- CORS allow-list includes production Wix domain and local dev origins
- Contract payloads served with `Cache-Control: public, max-age=3600`
- Publish failures must not overwrite last known-good contract snapshot
- Frontend hosted on **Azure Static Web Apps** (Free tier, `08d96e1`)
- `staticwebapp.config.json` enforces SPA fallback and CSP `frame-ancestors` for Wix/PlanCatalyst domains (`08d96e1`)

## 7) Ownership

Maintainer: Thomas Llamzon (pipeline, Azure, frontend, Wix embed).

See `TASKS.md` for deliverables and milestones.

## 8) Execution sequence

### Phase 1 - Features

1. Publish wired into the orchestrator (`622e3bf`). Done.
2. Production build fixed (`b88f74a`); frontend deployed on Azure SWA (`08d96e1`). Done.
3. `popdens` scorer uses the banded formula (`b19f1a8`). Done.
4. Manual publish per `docs/runbook-refresh.md` works; the Container Apps Job path is coded, not provisioned.
5. 2026-07-07 scoring fixes committed (2026-09-08). Done.
6. Public payload container republished and frontend redeployed 2026-09-29, run id `refresh-20260929`.
7. Open: mock parity pass; responsive QA at Wix iframe widths before the embed is placed.
8. `conces` is excluded from the MVP; `mspi` replaces it. Contract key `mspi` landed 2026-09-19.
9. `mspi` coverage rule applied 2026-09-24 and `mspi` is live. Open: About-page copy naming the excluded set.
10. Container Apps Job provisioning (service principal and role assignments) is pending.

### Phase 2 — QA / validation

5. Cleaning validation and data sanity checks.
6. CI hardening — **Done 2026-09-16.** Backend tests, Python/npm dependency
   audits, frontend production build, container build, and CodeQL run on
   `main` and pull requests.

### Phase 3 — Ops

7. PlanCatalyst-operable refresh: **code complete 2026-10-14, Azure provisioning
   pending.** Manual Container Apps Job with managed identity, newest ND-GAIN
   ZIP from the private ND-GAIN source container, one completion or
   failure line, email alert on failure. `infra/container-apps-job.sh`
   creates it; the playbook in `docs/playbook/` is written against it.

## 9) References

- `TASKS.md`
- `docs/data-contract.md`
- `docs/frontend-implementation-brief.md`
- `docs/repo-architecture.md`
- `docs/source-candidates.md`
- `docs/PRINCIPLES.md`
- `docs/runbook-refresh.md`
- `docs/spec-macrosec-index.md`
- `indicators/indicators.yaml`
- `indicators/SCORING_AUDIT.md`
- `src/upload/publish_dashboard.py`
- `src/config/settings.yaml`
