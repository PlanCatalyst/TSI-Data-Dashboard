# Handoff and Execution Context — PlanCatalyst Data Dashboard

> Active onboarding and execution guide. Last updated **2026-09-19**.

## 0) Status, 2026-09-29

The client thread reopened 2026-08-13 and was answered 2026-09-04. Three things define the current
state:

1. **All 28 indicators score correctly.** Issues #3, #4, #5 and #6 were closed 2026-07-07. The
   "scoring bugs" block that used to live in section 4 is resolved and has been rewritten.
2. **The scoring and forecasting work is committed on `main`.** Forecast
   quality gates, ARIMA intervals, atomic projection publish, and the
   projection-aware frontend are merged and locally verified.
3. **The live Blob was republished 2026-09-29** (`pipelineRunId: refresh-20260929`) with the
   2026-07-07 scoring fixes, `mspi` in place of `hdi`, and the contract §3.1 `indicatorStatus`
   field. Credentials: service principal `tsidashboard-pipeline`, Storage Blob Data Contributor on
   the `dashboard-public` container only, storage account `tsidashboardblobstorage` in
   PlanCatalyst's subscription (resource group `tsi-data-dashboard`). Secret expires 2027-09-28.
   The hosted frontend was redeployed the same evening and renders the status field.

**Operations:** publishing remains a manual run documented in
`docs/runbook-refresh.md`. A twice-yearly Azure Container Apps Job is tracked as
a follow-up; the pipeline container is now verified in CI.

## 1) Project at a glance

PlanCatalyst needs a backend pipeline that publishes contract-valid dashboard
JSON and a frontend that consumes only those payloads.

The dashboard is a decision-support product for identifying country-level need.
It is not an impact attribution system.

## 2) System flow

```
fetch -> clean -> score/aggregate -> publish contract JSON -> Azure Blob -> React frontend -> Wix iframe
```

Published contract files:

- `meta.json`
- `countries.json`
- `timeseries.json`

Contract source of truth: `docs/data-contract.md`

**Publish is now wired:** `orchestrator.py` calls `publish_dashboard` at the end of the run (`622e3bf`). The full chain — fetch → clean → score → upload → publish — executes in one command. Dry-run mode (`upload_azure: false`) writes JSON to `data/organized/v1/`; live mode (`upload_azure: true`) pushes to Azure Blob `dashboard-public/v1/`.

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
  (2026-09-19) after the client spec arrived. Composer wired; taxonomy maps
  `mspi` → `MSPI_INDEX`. See `docs/spec-macrosec-index.md`. Scored 2026-09-19
  at 117 countries vs HDI 193; the client confirmed on 2026-09-24 that
  non-covered countries are excluded rather than substituted, so `mspi` is
  cleared for the live snapshot.
- ~~Orchestrator → publish wiring~~ — **Closed 2026-07-03** (`622e3bf`). Full pipeline runs in one command.
- ~~`popdens` series_code missing~~ — **Closed** (`622e3bf`). WB cleaner now emits `EN.POP.DNST`.
- ~~`popdens` scorer formula saturating~~ — **Closed 2026-07-03** (`b19f1a8`). Banded 0/25/50/75/100 formula adopted from `indicators.yaml`. Display direction confirmed 2026-09-17: keep scored + inverted; dense countries display low.
- ~~Production `npm run build`~~ — **Closed** (`b88f74a`).
- ~~Frontend hosting~~ — **Closed 2026-07-03** (`08d96e1`). Deployed to Azure SWA: `https://jolly-pebble-0e2f9300f.7.azurestaticapps.net`.
- `VITE_CONTRACT_BASE_URL` — **set** in `dashboard/.env.production` and the Blob endpoint returns
  200. The file is gitignored, so a fresh clone silently falls back to bundled fixtures. See
  `docs/runbook-refresh.md`.
- **Storage account ownership unconfirmed; IT looked at the wrong account (2026-09-24).**
  PlanCatalyst IT reported no `dashboard-public` container, screenshotting `tsidatadashboard98a4`
  (two Functions runtime containers, nothing dashboard-related). The dashboard reads
  `tsidashboardblobstorage`, which is live and anonymous-readable. That account also has
  account-level public blob access disabled (HTTP 409 `PublicAccessNotPermitted`). If
  `tsidashboardblobstorage` is a personal subscription it must migrate before handoff, and the
  migration requires a frontend rebuild because the Blob URL is compiled in at build time. Reply
  for IT: `docs/azure-it-request.md`.
- ~~**No `.env` at repo root.**~~ **Closed 2026-09-29.** IT issued `tsidashboard-pipeline`;
  `.env` holds the four `AZURE_*` values locally and is gitignored. Secret expires 2027-09-28,
  so the refresh after that date needs a rotated secret from IT first.
- ~~Stale `data/clean/unsdg/un_sdg_clean.csv` (M49 codes vs ISO3)~~ — **Closed 2026-09-24.**
  Verified: 234 distinct country codes on disk, all ISO3, none numeric.
- Stale local fixtures `dashboard/public/v1/` (May 17) — fresh publish to `dashboard-public`.
- ~~ACR push rights blocked~~ — **Descoped 2026-09-04.** Containerised scheduling is no longer part
  of the delivery. `docs/docker.md` is retained in case the cadence ever shortens.
- Frontend presentability / mock parity — **Thomas** (unblocked).

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

- Automation / alerting — **deferred follow-up.**

## 5) Legacy output policy

`domainscores.csv`, `sectorscores.csv`, `subsectorscores.csv` are compatibility
outputs from the legacy 3-level hierarchy. They are not required by the new
frontend contract.

Default policy: keep transitionally, gate with configuration, remove when unused.

## 6) Azure and deployment expectations

- Private container for backend artifacts (`validated-scores`)
- Public-read container for frontend payloads (`dashboard-public`)
- CORS allow-list includes production Wix domain and local dev origins
- Contract payloads served with `Cache-Control: public, max-age=3600`
- Publish failures must not overwrite last known-good contract snapshot
- Frontend hosted on **Azure Static Web Apps** (`tsi-dashboard-frontend`, Free tier, `rg tsi-data-dashboard`) — **live at `https://jolly-pebble-0e2f9300f.7.azurestaticapps.net`** (`08d96e1`)
- `staticwebapp.config.json` enforces SPA fallback and CSP `frame-ancestors` for Wix/PlanCatalyst domains (`08d96e1`)

## 7) Ownership

| Person | Scope |
|--------|-------|
| **Thomas Llamzon** | Remaining delivery (pipeline, Azure, frontend, Wix E2E). Finishing the project solo as of 2026-09-19. |

See `TASKS.md` for deliverables and milestones.

## 8) Immediate execution sequence

### Phase 1 — Features (now)

1. ~~**Anthony:** Wire publish into orchestrator~~ — **Done** (`622e3bf`).
2. ~~**Thomas:** Fix production build~~ — **Done** (`b88f74a`). ~~Deploy frontend on Azure~~ — **Done** (`08d96e1`, SWA live).
3. ~~**Thomas:** Fix `popdens` scorer formula~~ — **Done** (`b19f1a8`, banded formula).
4. ~~**Anthony (blocker):** Grant ACR push rights~~ — **Descoped 2026-09-04.** Replaced by a manual
   publish per `docs/runbook-refresh.md`.
5. ~~**Thomas (now):** Commit the 2026-07-07 fix work.~~ **Done 2026-09-08.**
6. ~~**Thomas:** Republish `dashboard-public/v1/` and redeploy the frontend.~~ **Both done
   2026-09-29**, run id `refresh-20260929`.
7. **Thomas (unblocked):** Mock parity pass; responsive QA at Wix iframe widths before the client
   places the embed.
8. ~~**Thomas:** Route `conces` MVP exclusion sign-off to PlanCatalyst.~~ — **Answered 2026-08-13;
   spec received 2026-09-17.** Contract key `mspi` landed 2026-09-19.
9. **Thomas:** Client confirmation of `mspi` coverage (117 vs HDI 193) before
   swapping the live snapshot. Composer is scored. About-page copy after that.
10. **Thomas:** Do not book the wrap-up call yet. Reyna wants it after IT finishes the
    service-principal request.

### Phase 2 — QA / validation

5. Cleaning validation and data sanity checks.
6. CI hardening — **Done 2026-09-16.** Backend tests, Python/npm dependency
   audits, frontend production build, container build, and CodeQL run on
   `main` and pull requests.

### Phase 3 — Ops

7. Automation and alerting — **deferred follow-up.** Target: twice-yearly
   Azure Container Apps Job with managed identity and failure alerts. The
   interim rollback and refresh procedure lives in `docs/runbook-refresh.md`.

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
