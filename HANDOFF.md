# Handoff and Execution Context — PlanCatalyst Data Dashboard

> Active onboarding and execution guide. Last updated **2026-07-04**.

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
- `VITE_CONTRACT_BASE_URL` → prod Blob URL — **open**. Needs **Anthony** to publish live JSON to `dashboard-public/v1/` and provide the URL. **Thomas** rebuilds + redeploys.
- Stale `data/clean/unsdg/un_sdg_clean.csv` (M49 codes vs ISO3) — **Anthony** (re-run cleaner).
- Stale local fixtures `dashboard/public/v1/` (May 17) — **Anthony** (fresh publish to `dashboard-public`).
- ACR push rights blocked — **Anthony** (Contributor scoped to registry, see `docs/docker.md`).
- Frontend presentability / mock parity — **Thomas** (unblocked).
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

See `TEAM-TASKS.md` for deliverables and milestones.

## 8) Immediate execution sequence

### Phase 1 — Features (now)

1. ~~**Anthony:** Wire publish into orchestrator~~ — **Done** (`622e3bf`).
2. ~~**Thomas:** Fix production build~~ — **Done** (`b88f74a`). ~~Deploy frontend on Azure~~ — **Done** (`08d96e1`, SWA live).
3. ~~**Thomas:** Fix `popdens` scorer formula~~ — **Done** (`b19f1a8`, banded formula).
4. **Anthony (blocker):** Grant ACR push rights → build/push image → first live publish to `dashboard-public/v1/` → send Thomas the prod `VITE_CONTRACT_BASE_URL`.
5. **Thomas (unblocked):** Mock parity pass; verify `popdens` renders in live fixture; set `VITE_CONTRACT_BASE_URL`, rebuild, redeploy to SWA; E2E on hosted app + live JSON; embed in Wix.
6. **Thomas:** Route `conces` MVP exclusion sign-off to PlanCatalyst.

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
