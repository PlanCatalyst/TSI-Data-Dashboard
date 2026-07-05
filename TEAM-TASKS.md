# Team Tasks — June Execution Plan

> Last updated: **2026-07-04**.

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

## Progress snapshot (as of 2026-07-04)

### Done

- [x] Four frontend routes: Explore, Compare, Map, About
- [x] Contract loaders, dashboard context, loading/error states
- [x] `publish_dashboard.py` builders + Azure upload path
- [x] Wix iframe height/hash sync
- [x] 28/28 indicators flow end-to-end through scoring into published JSON (`hdi` replaced `conces` 2026-06-01; `popdens` series_code fixed; `gii`, `mpi`, `ndgain`, `state` closed May 2026)
- [x] Multi-source fetch/clean/score pipeline (UN SDG, WB, ND-GAIN, UNDP HDR, WGI)
- [x] **Publish wired into orchestrator** — one command runs full pipeline (`622e3bf`)
- [x] **`popdens` scorer formula fixed** — banded 0/25/50/75/100 from `indicators.yaml` (`b19f1a8`)
- [x] `npm run build` passes (`b88f74a`)
- [x] Self-host world-atlas geometry (`5dab0f2`)
- [x] **Frontend deployed to Azure SWA** — `https://jolly-pebble-0e2f9300f.7.azurestaticapps.net` (`08d96e1`)
- [x] `staticwebapp.config.json` — SPA fallback + CSP `frame-ancestors` for Wix embed (`08d96e1`)
- [x] Dockerfile, `.dockerignore`, `scripts/acr_build.sh` (`84cc950`)

### Open — Phase 1 (features)

| # | Task | Owner | Priority | Notes |
|---|------|-------|----------|-------|
| 1 | ACR push rights → build/push image → pick pipeline host | Anthony | **P0 blocker** | Needs Contributor on registry; see `docs/docker.md` |
| 2 | First live publish to `dashboard-public/v1/` | Anthony | **P0 blocker** | Unlocks Thomas rebuilding with prod URL |
| 3 | Set `VITE_CONTRACT_BASE_URL` → prod Blob URL, rebuild, redeploy SWA | Thomas | P0 | Blocked on #2 above |
| 4 | Mock parity + UI polish (all pages) | Thomas | P0 | Unblocked |
| 5 | Wix E2E on hosted app + live JSON | Thomas + Anthony | P0 | Blocked on #2 |
| 6 | `conces` MVP exclusion — PlanCatalyst sign-off | Thomas → Anthony | P1 | Proposed in `SCORING_AUDIT.md`; needs client confirmation |
| 7 | `popdens` semantic direction sign-off | Thomas → PlanCatalyst | P1 | Banded formula live; confirm scored/inverted vs display-only |
| 8 | Refresh stale UN SDG cleaned CSV (ISO3) | Anthony | P1 | On-disk `un_sdg_clean.csv` still uses M49 codes |
| 9 | Responsive QA vs mock | Thomas | P1 | Unblocked |

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
5. ~~`conces`~~ — **Replaced by `hdi`** for `pri/macrosec` (2026-06-01). MVP exclusion proposed; needs PlanCatalyst sign-off.
6. ~~`popdens` WB cleaner missing `series_code`~~ — **Closed** (`622e3bf`). `EN.POP.DNST` now emitted.
7. ~~`popdens` scorer saturating formula~~ — **Closed 2026-07-03** (`b19f1a8`). Banded 0/25/50/75/100 live. Semantic direction still needs PlanCatalyst confirmation.
8. ~~Orchestrator → publish wiring~~ — **Closed 2026-07-03** (`622e3bf`). Full pipeline in one command.
9. ~~Frontend hosting~~ — **Closed 2026-07-03** (`08d96e1`). Azure SWA live.
10. **Stale UN SDG CSV** — on-disk `data/clean/unsdg/un_sdg_clean.csv` uses M49 numeric codes, not ISO3. **Anthony** (re-run cleaner / pipeline).
11. **Live JSON not yet in `dashboard-public/v1/`** — ACR push rights blocked; Anthony must resolve to unblock first live publish and Thomas's prod build.

---

## Owner deliverables

### Thomas — PM + full-stack presentability

1. Mock-vs-app punch list for all four pages; close visual/interaction gaps. *(unblocked)*
2. Missing-indicator UX for `popdens` / sparse pillars (`conces` replaced by `hdi` — no special UI needed).
3. ~~Production build~~ — **Done** (`b88f74a`). ~~Frontend hosting~~ — **Done**, SWA live (`08d96e1`).
4. Once Anthony provides prod `VITE_CONTRACT_BASE_URL`: rebuild with prod URL → redeploy SWA → E2E verification.
5. Route `conces` exclusion sign-off + `popdens` semantic direction to PlanCatalyst.

**Done when:** Dashboard is client-presentable; hosted app reads live Azure JSON.

---

### Anthony — backend, indicators, Azure

1. ~~Publish step in orchestrator~~ — **Done** (`622e3bf`). Full pipeline in one command.
2. ~~Azure frontend hosting~~ — **Done** by Thomas (`08d96e1`); SWA live. **Remaining:** CORS on `dashboard-public` container and secrets review.
3. **[P0 blocker]** Grant ACR push rights → build/push image → pick pipeline execution host → first live publish to `dashboard-public/v1/` → send Thomas the prod `VITE_CONTRACT_BASE_URL`.
4. ~~`popdens` series_code~~ — **Done** (`622e3bf`). ~~Scorer formula~~ — **Done** (`b19f1a8`). Remaining: confirm direction with PlanCatalyst via Thomas.
5. Re-run cleaners; fix stale UN SDG ISO3 on-disk artifact.
6. Phase 3: automation, alerting, runbook.

**Done when:** ACR push is unblocked, pipeline runs in Azure container, and live JSON is in `dashboard-public/v1/`.

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
