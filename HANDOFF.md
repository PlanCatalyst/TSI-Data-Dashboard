# Handoff and Execution Context — PlanCatalyst Data Dashboard

> Active onboarding and execution guide. Last updated **2026-09-04**.

## 0) Status, 2026-09-04

The client thread reopened 2026-08-13 and was answered 2026-09-04. Three things define the current
state:

1. **All 28 indicators score correctly.** Issues #3, #4, #5 and #6 were closed 2026-07-07. The
   "scoring bugs" block that used to live in section 4 is resolved and has been rewritten.
2. **That fix work is uncommitted.** Roughly 176k insertions across 16 files sit on `main`. Until it
   is committed, anything reading git history reports the pre-fix world, which is exactly how stale
   bug numbers reached a client email.
3. **The live site serves a 2026-07-01 snapshot** (`pipelineRunId: fresh-20260701`), predating those
   fixes, so the deployed `ag` pillar still looks saturated. A republish is owed to the client and
   is blocked on credentials.

**Architecture change:** the containerised scheduled pipeline is descoped. At the client-confirmed
6-month refresh cadence it is not worth its cost. Publishing is a manual workstation run, documented
in `docs/runbook-refresh.md`. The ACR blocker is therefore no longer on the critical path.

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
- ~~`conces`~~ — **Replaced by `hdi`** as the `pri/macrosec` slot (2026-06-01). MVP exclusion proposed; needs PlanCatalyst sign-off to formalise.
- ~~Orchestrator → publish wiring~~ — **Closed 2026-07-03** (`622e3bf`). Full pipeline runs in one command.
- ~~`popdens` series_code missing~~ — **Closed** (`622e3bf`). WB cleaner now emits `EN.POP.DNST`.
- ~~`popdens` scorer formula saturating~~ — **Closed 2026-07-03** (`b19f1a8`). Banded 0/25/50/75/100 formula adopted from `indicators.yaml`. Semantic direction (scored/inverted vs display-only) still needs PlanCatalyst confirmation.
- ~~Production `npm run build`~~ — **Closed** (`b88f74a`).
- ~~Frontend hosting~~ — **Closed 2026-07-03** (`08d96e1`). Deployed to Azure SWA: `https://jolly-pebble-0e2f9300f.7.azurestaticapps.net`.
- `VITE_CONTRACT_BASE_URL` — **set** in `dashboard/.env.production` and the Blob endpoint returns
  200. The file is gitignored, so a fresh clone silently falls back to bundled fixtures. See
  `docs/runbook-refresh.md`.
- **Storage account ownership unconfirmed.** `tsidashboardblobstorage` may sit on a personal Azure
  subscription rather than PlanCatalyst's. If so it must migrate before handoff, and the migration
  requires a frontend rebuild because the Blob URL is compiled in at build time.
- **No `.env` at repo root** — publish credentials are not held locally. Republish is blocked until
  either Anthony supplies the current credentials or PlanCatalyst's IT issues the new service
  principal.
- Stale `data/clean/unsdg/un_sdg_clean.csv` (M49 codes vs ISO3) — **Anthony** (re-run cleaner).
- Stale local fixtures `dashboard/public/v1/` (May 17) — **Anthony** (fresh publish to `dashboard-public`).
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
- ⚠️ **None of this is live.** These fixes are uncommitted and unpublished. The deployed dashboard
  still serves the pre-fix 2026-07-01 snapshot until a republish happens.

- Automation / alerting — **Anthony** (Phase 3).

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
| **Thomas Llamzon** | PM · full-stack · frontend presentability · Wix E2E |
| **Anthony Lam** | Co-PM · Azure · indicators · cleaning · publish · automation |

See `TASKS.md` for deliverables and milestones.

## 8) Immediate execution sequence

### Phase 1 — Features (now)

1. ~~**Anthony:** Wire publish into orchestrator~~ — **Done** (`622e3bf`).
2. ~~**Thomas:** Fix production build~~ — **Done** (`b88f74a`). ~~Deploy frontend on Azure~~ — **Done** (`08d96e1`, SWA live).
3. ~~**Thomas:** Fix `popdens` scorer formula~~ — **Done** (`b19f1a8`, banded formula).
4. ~~**Anthony (blocker):** Grant ACR push rights~~ — **Descoped 2026-09-04.** Replaced by a manual
   publish per `docs/runbook-refresh.md`.
5. **Thomas (now):** Commit the 2026-07-07 fix work. It is the root cause of every stale status
   report in this repo and in the client thread.
6. **Thomas (blocked on credentials):** Republish `dashboard-public/v1/` so the live site stops
   serving the pre-fix snapshot. Promised to the client.
7. **Thomas (unblocked):** Mock parity pass; responsive QA at Wix iframe widths before the client
   places the embed.
8. ~~**Thomas:** Route `conces` MVP exclusion sign-off to PlanCatalyst.~~ — **Answered 2026-08-13.**
   The client declined the `hdi` substitution and supplied a substitute composite formula. The
   document has not been received; re-requested 2026-09-04. `hdi` holds the slot meanwhile.

### Phase 2 — QA / validation

5. Cleaning validation and data sanity checks (Anthony + Thomas).
6. Merge frontend test branch when entering hardening.

### Phase 3 — Ops

7. ~~Automation, alerting~~ — **descoped with the container path.** At two runs a year there is no
   scheduled job to alert on. The rollback and refresh procedure lives in
   `docs/runbook-refresh.md`.

## 9) References

- `TASKS.md`
- `docs/data-contract.md`
- `docs/frontend-implementation-brief.md`
- `docs/repo-architecture.md`
- `docs/source-candidates.md`
- `docs/PRINCIPLES.md`
- `docs/runbook-refresh.md`
- `indicators/indicators.yaml`
- `indicators/SCORING_AUDIT.md`
- `src/upload/publish_dashboard.py`
- `src/config/settings.yaml`
