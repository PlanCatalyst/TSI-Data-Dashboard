# Handoff and Execution Context - PlanCatalyst Data Dashboard

> Imported from legacy repository on 2026-04-24. This document is now maintained
> as an active onboarding and execution guide for the new codebase.

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

Contract source of truth:
- `docs/data-contract.md`

## 3) Load-bearing invariants

1. Frontend-facing scores are `higher_is_better`.
2. `iso3` is canonical key across all contract files.
3. Missing observations stay `null`.
4. Contract-breaking changes require path/version bump (`/v1` -> `/v2`).
5. Frontend does not read internal CSV artifacts directly.

## 4) Current known gaps to close

From `indicators/SCORING_AUDIT.md`:

- `gii`: missing UNDP HDR ingestion path
- `mpi`: missing UNDP HDR ingestion path
- `ndgain`: component data exists; composite score path incomplete
- `state`: no complete data/scorer wiring
- `conces`: no complete data/scorer wiring
- `popdens`: scorer formula mismatch vs taxonomy notes
- `publish_dashboard.py`: partially scaffolded, not fully implemented

## 5) Legacy output policy

`domainscores.csv`, `sectorscores.csv`, `subsectorscores.csv` are compatibility
outputs from the legacy 3-level hierarchy. They are not required by the new
frontend contract.

Default policy in new repo:
- keep them temporarily during transition
- gate with configuration
- remove after confirmed no downstream consumers

## 6) Azure and deployment expectations

- Private container for backend artifacts (`validated-scores`)
- Public-read container for frontend payloads (`dashboard-public`)
- CORS allow-list includes production Wix domain and local dev origins
- Contract payloads served with `Cache-Control: public, max-age=3600`
- Publish failures must not overwrite last known-good contract snapshot

## 7) Ownership model

- PM: Thomas
- Co-PM: Azure platform and operations
- Adeline: frontend UX/design parity
- Christina: frontend integration plus backend publish/API integration
- Tyler: cleaning reliability and backend pipeline co-owner
- Caroline: source coverage closure
- Kayden: projections research only (data science scope)

See `TEAM-TASKS.md` for milestone-level tasking and definitions of done.

## 8) Immediate execution sequence

1. Finalize publish implementation against `docs/data-contract.md`.
2. Close source coverage gaps (Caroline + Tyler + Christina).
3. Complete frontend data wiring and parity states.
4. Run end-to-end publish in Azure test path.
5. Enable automation + alerting and validate rollback runbook.

## 9) References

- `docs/data-contract.md`
- `docs/frontend-implementation-brief.md`
- `docs/repo-architecture.md`
- `docs/source-candidates.md`
- `indicators/indicators.yaml`
- `indicators/SCORING_AUDIT.md`
- `TEAM-TASKS.md`
- `src/upload/publish_dashboard.py`
- `src/config/settings.yaml`
