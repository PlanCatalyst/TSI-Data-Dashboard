# Team Tasks — June Execution Plan

> Last updated: **2026-06-02**.

## Project goal

Ship a **client-ready PlanCatalyst dashboard**: automated pipeline publishes
contract-valid JSON; React frontend (Wix iframe) matches
`PlanCatalyst TSI Data Dashboard Final.html`; hosted on Azure with live Blob data.

**Phasing:** features and presentability first → data QA / cleaning validation →
automation and ops hardening.

---

## Team

| Person | Role |
|--------|------|
| **Thomas Llamzon** | PM · full-stack · frontend presentability · Wix E2E · pipeline support |
| **Anthony Lam** | Co-PM · Azure hosting · indicators · cleaning · publish · automation |

---

## Work split

### Thomas

- Mock parity pass on Explore, Compare, Map, About
- UI polish, responsive QA, null/missing-indicator states (especially `conces`, `popdens`)
- Production frontend build (`npm run build`) and Wix E2E once Anthony hosts
- Wire frontend to live Blob via `VITE_CONTRACT_BASE_URL`
- Light pipeline/publish support; cleaning validation (Phase 2)

### Anthony

- Wire `publish_dashboard` into `orchestrator.py` (pipeline currently stops after CSV upload)
- Run fresh pipeline + publish to `dashboard-public/v1/`
- Azure Static Web Apps / Blob hosting, CORS, secrets
- Close indicator gaps: `popdens`, `conces` (or formal MVP exclusion)
- Refresh stale UN SDG cleaned CSV (ISO3 country codes)
- Cleaning reliability and validation
- Scheduled runs, alerting, ops runbook (Phase 3)

---

## Locked directives

1. **Contract path:** `/v1/` now; breaking changes require `/v2/`.
2. **Frontend blueprint:** `PlanCatalyst TSI Data Dashboard Final.html` is client-approved.
3. **Tech stack:** Azure Blob + custom React only. No Power BI / AWS / BI tools.
4. **Publish phasing:** validate locally (`dry_run` → `data/organized/v1/`) before Azure upload.
5. **Decision routing:** Thomas (PM) + Anthony (Co-PM). Contract-semantic changes get recorded in docs.
6. **Repo hygiene:** upload code in `src/upload/`; settings in `src/config/settings.yaml`.

---

## Non-negotiable invariants

1. `docs/data-contract.md` is the frontend/backend contract source of truth.
2. Frontend reads only published JSON from Blob (local `/v1` fallback for dev only).
3. Scores in published JSON are `higher_is_better`, range `[0, 100]`.
4. `iso3` is the canonical join key.
5. Missing data is `null` — never omitted keys or sentinel `0`.
6. Score inversion (`100 - x`) happens only in `publish_dashboard.py`.

---

## Progress snapshot (as of 2026-06-02)

### Done

- [x] Four frontend routes: Explore, Compare, Map, About
- [x] Contract loaders, dashboard context, loading/error states
- [x] `publish_dashboard.py` builders + Azure upload path
- [x] Wix iframe height/hash sync
- [x] 25/28 indicators scoring (`gii`, `mpi`, `ndgain`, `state` closed May 2026)
- [x] Multi-source fetch/clean/score pipeline (UN SDG, WB, ND-GAIN, UNDP HDR, WGI)

### Open — Phase 1 (features)

| # | Task | Owner | Priority |
|---|------|-------|----------|
| 1 | Wire publish into orchestrator | Anthony | P0 |
| 2 | Fresh pipeline run + Blob publish | Anthony | P0 |
| 3 | Azure frontend hosting + prod Blob URL | Anthony | P0 |
| 4 | Mock parity + UI polish (all pages) | Thomas | P0 |
| 5 | Fix `npm run build` (tsconfig/vite) | Thomas | P0 |
| 6 | Wix E2E on hosted app + live JSON | Thomas + Anthony | P0 |
| 7 | Fix `popdens` (cleaner `series_code` + scorer) | Anthony | P1 |
| 8 | `conces`: PlanCatalyst formula **or** MVP exclusion + UI | Thomas → Anthony | P1 |
| 9 | Refresh stale UN SDG cleaned CSV (ISO3) | Anthony | P1 |
| 10 | Self-host world-atlas geometry (optional CSP fix) | Thomas | P2 |
| 11 | Responsive QA vs mock | Thomas | P1 |

### Open — Phase 2 (QA / validation)

| # | Task | Owner |
|---|------|-------|
| 12 | Cleaning validation pass (logical anomalies, join checks) | Anthony + Thomas |
| 13 | Frontend tests (Vitest + vite fixes on open branch) | Thomas |
| 14 | Per-indicator data sanity review | Anthony + Thomas |
| 15 | Null-heavy country / pillar edge-case QA | Thomas |

### Open — Phase 3 (automation / ops)

| # | Task | Owner |
|---|------|-------|
| 16 | Scheduled pipeline + manual trigger | Anthony |
| 17 | Failure alerting / notifications | Anthony |
| 18 | Rollback runbook for bad publish | Anthony |
| 19 | CI (build + publish validation) | Anthony + Thomas |

### Deferred post-MVP

- **Projections** (`meta.projections.enabled === false`). No ship target for MVP.
- **`conces`** if PlanCatalyst cannot define formula in time — document explicit exception.

---

## Known implementation gaps

1. ~~`publish_dashboard.py` skeleton~~ — **Closed.** Builders + upload exist; orchestrator wiring remains (**Anthony**).
2. ~~`ndgain` composite~~ — **Closed 2026-05-17** (Anthony).
3. ~~`gii` / `mpi` UNDP paths~~ — **Closed 2026-05-17** (Anthony).
4. ~~`state` source wiring~~ — **Closed 2026-05-17** — WGI Government Effectiveness (Anthony).
5. **`conces`** — deferred. PlanCatalyst formula needed (`docs/source-candidates.md`). **Thomas** routes to client → **Anthony** implements.
6. **`popdens`** — scorer/taxonomy mismatch; WB cleaner missing `series_code`. **Anthony**.
7. **Stale UN SDG CSV** — on-disk file uses M49 numeric codes, not ISO3. **Anthony** (re-run cleaner / pipeline).
8. **Local fixtures stale** — `dashboard/public/v1/` from May 17 dry run. **Anthony** (fresh publish).

---

## Owner deliverables

### Thomas — PM + full-stack presentability

1. Mock-vs-app punch list for all four pages; close visual/interaction gaps.
2. Missing-indicator UX for `conces` / `popdens` / sparse pillars.
3. Production build working; coordinate Wix deploy with Anthony.
4. E2E verification: all routes load live Blob JSON in hosted environment.
5. Route `conces` methodology questions to PlanCatalyst.

**Done when:** Dashboard is client-presentable; hosted app reads live Azure JSON.

---

### Anthony — backend, indicators, Azure

1. Publish step in orchestrator; unattended fetch → clean → score → publish → Blob.
2. Azure frontend hosting + CORS + secrets for Wix and local dev.
3. Fresh `/v1/*.json` in `dashboard-public`; provide Thomas prod `VITE_CONTRACT_BASE_URL`.
4. Close `popdens`; resolve or formally exclude `conces`.
5. Re-run cleaners; fix UN SDG ISO3 on-disk artifact.
6. Phase 3: automation, alerting, runbook.

**Done when:** One command runs the full pipeline and updates live contract JSON.

---

## Completion criteria (MVP launch)

1. Hosted frontend on Azure; Wix iframe loads production URL.
2. Frontend reads contract JSON from Blob (`dashboard-public/v1/`).
3. All four pages functional against live data.
4. Publish runs as part of pipeline (or documented single post-step) with validation gate.
5. Indicators: all live **or** explicit client-approved exceptions in `SCORING_AUDIT.md`.
6. Post-MVP work (projections, deep automation) tracked with owner + ETA.

---

## Risk register

| Risk | Owner | Mitigation |
|------|-------|------------|
| `conces` blocks `pri` pillar | Thomas + Anthony | Client formula or MVP exclusion + UI |
| `popdens` dropped at scoring | Anthony | Fix cleaner + scorer in one PR |
| Stale / mismatched ISO3 joins | Anthony | Re-run pipeline; validate poverty rollup |
| Publish not in orchestrator | Anthony | Wire + test end-to-end |
| Map CDN blocked in prod CSP | Thomas | Bundle world-atlas in `public/` |
| Schema drift frontend ↔ publish | Thomas + Anthony | Contract guards in loaders; re-test after publish |

---

## Reporting cadence

- Thomas + Anthony sync at least twice weekly.
- Blockers > 48h: escalate between PM and Co-PM for decision.
