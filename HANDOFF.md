# Handoff and Execution Context — PlanCatalyst Data Dashboard

> Active onboarding and execution guide. Last updated **2026-06-02**.

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

**Current wiring gap:** `orchestrator.py` runs fetch → clean → score → upload
validated CSVs, but does **not** yet call `publish_dashboard`. Publish is a
manual step today. Owner: **Anthony**.

## 3) Load-bearing invariants

1. Frontend-facing scores are `higher_is_better`.
2. `iso3` is canonical key across all contract files.
3. Missing observations stay `null`.
4. Contract-breaking changes require path/version bump (`/v1` → `/v2`).
5. Frontend does not read internal CSV artifacts directly.

## 4) Current known gaps

From `indicators/SCORING_AUDIT.md` (as of 2026-06-02):

- ~~`gii`~~ — **Closed 2026-05-17** (`UNDPHDRFetcher`).
- ~~`mpi`~~ — **Closed 2026-05-17** (`UNDPHDRFetcher`).
- ~~`ndgain` composite~~ — **Closed 2026-05-17** (published `vulnerability.csv`).
- ~~`state`~~ — **Closed 2026-05-17** (WGI Government Effectiveness).
- `conces` — deferred. PlanCatalyst formula required. **Thomas** routes to client; **Anthony** implements.
- `popdens` — scorer/taxonomy mismatch; WB cleaner missing `series_code`. **Anthony**.
- Orchestrator → publish wiring — **Anthony**.
- Stale `data/clean/unsdg/un_sdg_clean.csv` (M49 codes vs ISO3) — **Anthony** (re-run cleaner).
- Stale local fixtures `dashboard/public/v1/` (May 17) — **Anthony** (fresh publish).
- Frontend presentability / mock parity — **Thomas**.
- Production `npm run build` — **Thomas**.
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
- Frontend hosted on Azure (Static Web Apps or Blob `$web`) — **Anthony**

## 7) Ownership

| Person | Scope |
|--------|-------|
| **Thomas Llamzon** | PM · full-stack · frontend presentability · Wix E2E |
| **Anthony Lam** | Co-PM · Azure · indicators · cleaning · publish · automation |

See `TEAM-TASKS.md` for deliverables and milestones.

## 8) Immediate execution sequence

### Phase 1 — Features (now)

1. **Anthony:** Wire publish into orchestrator; run fresh publish to Blob; deploy frontend on Azure.
2. **Thomas:** Mock parity pass; fix production build; E2E on hosted app + live JSON.
3. **Anthony:** Fix `popdens`; refresh UN SDG cleaned CSV.
4. **Thomas:** Route `conces` to PlanCatalyst or approve MVP exclusion.

### Phase 2 — QA / validation

5. Cleaning validation and data sanity checks (Anthony + Thomas).
6. Merge frontend test branch when entering hardening.

### Phase 3 — Ops

7. Automation, alerting, rollback runbook (Anthony).

## 9) References

- `TEAM-TASKS.md`
- `docs/data-contract.md`
- `docs/frontend-implementation-brief.md`
- `docs/repo-architecture.md`
- `docs/source-candidates.md`
- `docs/PRINCIPLES.md`
- `indicators/indicators.yaml`
- `indicators/SCORING_AUDIT.md`
- `src/upload/publish_dashboard.py`
- `src/config/settings.yaml`
