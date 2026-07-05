# Delivery Checklist — PlanCatalyst Data Dashboard

> The single source of truth for **what's left to ship**. Reflects actual repo
> state as of **2026-07-04**. Owners: **T** = Thomas, **A** = Anthony.
> Pair with `TEAM-TASKS.md` (work split / philosophy) and
> `docs/data-contract.md` (contract source of truth).

## How to use

- `[x]` done · `[~]` in progress / partial · `[ ]` not started.
- Each item lists an **owner** and, where useful, the **blocker** or **verify** step.
- "Done when" at the end of each phase is the gate to move on.
- Definition of "delivered" = **Phase 6 acceptance criteria all green**.

---

## Phase 0 — Definition of Done (the bar)

- [ ] One command (`python -m src.pipeline.run_pipeline`) runs fetch → clean → score → upload → publish with **no manual steps**. *(A)*
- [ ] Pipeline runs **unattended on a schedule** in Azure and republishes contract JSON. *(A)*
- [ ] Pipeline is **error-proofed**: transient failures retry; a bad run never overwrites the last good `/v1/` snapshot. *(A)*
- [ ] Frontend is **hosted on Azure**, reads live Blob JSON, and is **embedded in Wix** end-to-end. *(T + A)*
- [ ] All 28 indicators are **live or have a client-approved exception** recorded in `SCORING_AUDIT.md`. *(T + A)*
- [ ] Contract validation gates every publish; CI guards build + contract shape. *(T + A)*

---

## Phase 1 — Pipeline correctness & data quality

- [x] 5 sources wired through fetch → clean → score (UN SDG, World Bank, ND-GAIN, UNDP HDR, WB WGI). *(A)*
- [x] `gii`, `mpi`, `ndgain`, `state`, `hdi` scoring live. *(A)*
- [x] `popdens` fix — WB cleaner emits `series_code`; `EN.POP.DNST` registered with `DensityScorer`. *(T, `622e3bf`)*
- [x] Publish wired into orchestrator (dry-run → `data/organized/v1/`, or Azure when creds + `upload_azure`). *(T, `622e3bf`)*
- [ ] **Run the full pipeline locally end-to-end** with `fetch_raw: false` to confirm popdens + publish flow through to JSON. *(T — verify; only unit-checked so far)*
- [ ] Refresh stale `data/clean/unsdg/un_sdg_clean.csv` (M49 → ISO3) via a fresh clean run. *(A — scoring now resolves ISO3 at runtime, but on-disk artifact is still stale)*
- [x] `popdens` scorer **formula** fix — adopted banded 0/25/50/75/100 formula from `indicators.yaml`; previous `(value/0.7)*100` saturated 99.6% of rows. *(T, `b19f1a8`)* Semantic direction (scored/inverted vs display-only) still needs PlanCatalyst sign-off; see `SCORING_AUDIT.md` row 27.
- [ ] `conces` decision: PlanCatalyst provides composite formula **or** sign off on MVP exclusion + record exception in `SCORING_AUDIT.md`. *(T routes → A implements)*
- [ ] Per-indicator data sanity review (spot-check values vs source for ~5 countries across pillars). *(T + A)*
- [ ] Null-heavy country / empty-pillar review — confirm no `0`/`NaN` sentinels leak; blanks are real `null`. *(T)*

**Done when:** a fresh run scores all intended indicators, ISO3 joins are clean, and `conces`/`popdens` are either live or formally excepted.

---

## Phase 2 — Backend hosting (Azure + containerization)

- [x] `Dockerfile`, `.dockerignore`, `scripts/acr_build.sh` in place. *(A)*
- [x] ACR registry `TSIcontainers` exists (Canada Central, RG `tsi-data-dashboard`). *(A)*
- [ ] **Grant push rights** — service principal / build identity needs **Contributor scoped to the registry** (requires Owner / User Access Administrator). Build currently cannot push. *(A — blocker, see `docs/docker.md`)*
- [ ] Build + push image to ACR (`scripts/acr_build.sh`); verify tags. *(A)*
- [ ] **Choose execution host** — Azure Container Instances vs Container Apps Job vs scheduled VM. *(A — not chosen yet)*
- [ ] Deploy image to the chosen host with `AZURE_*` injected at runtime (never baked in). *(A)*
- [ ] First **live publish** to `dashboard-public/v1/` (`upload_azure: true`, creds set). *(A)*
- [ ] Confirm public-read on `dashboard-public`; private on `validated-scores`. *(A)*

**Done when:** the containerized pipeline runs on Azure and publishes a valid `/v1/` snapshot to Blob.

---

## Phase 3 — Automation & scheduling

- [ ] Scheduled trigger (cron / Container Apps Job schedule / Logic App) for unattended runs. *(A)*
- [ ] Manual trigger path documented (one command or portal action) for ad-hoc refresh. *(A)*
- [ ] Decide refresh cadence with PlanCatalyst (monthly? quarterly? on-source-update?). *(T routes → A)*
- [ ] Idempotency check — re-running without new upstream data doesn't corrupt or partially publish. *(A)*

**Done when:** the pipeline refreshes contract JSON on a schedule with no human in the loop.

---

## Phase 4 — Reliability, error-proofing & stress testing

- [ ] **Publish atomicity** verified — payload files upload first, `manifest.json` last; a mid-run failure leaves the prior snapshot live. *(A — code does this; needs a fault-injection test)*
- [ ] Validation-gate test — feed a deliberately broken payload, confirm `validate_payload` aborts upload. *(T + A)*
- [ ] Upstream-failure handling — simulate a source timing out / returning 5xx; confirm retries then graceful skip vs hard fail policy. *(A)*
- [ ] Partial-source run — confirm one dead source doesn't blank unrelated pillars (per-source isolation). *(A)*
- [ ] Malformed-input resilience — empty CSV, missing columns, NaN floods, duplicate rows, unexpected country codes. *(A)*
- [ ] Large-input / memory check — full `all` countries × all indicators × all years run profile. *(A)*
- [ ] Rate-limit behavior — UN SDG slow/429 path exercises backoff without crashing. *(A)*
- [ ] Network-flap during Azure upload — confirm retry / clean abort. *(A)*

**Done when:** known failure modes are exercised and each either recovers or fails safe (no partial publish).

---

## Phase 5 — Observability, alerting & rollback

- [ ] Structured run logs persisted (run id, per-stage timing, row counts, skipped series). *(A)*
- [ ] Failure alerting (email / Slack / Azure Monitor) on pipeline or publish failure. *(A)*
- [ ] Rollback runbook — how to restore the previous `/v1/` snapshot if a bad publish slips through. *(A)*
- [ ] Snapshot retention / versioning of published payloads for rollback. *(A)*

**Done when:** a failed or bad run is visible within one cycle and can be rolled back from a written runbook.

---

## Phase 6 — Contract integrity & validation

- [x] `validate_payload` enforces region/pillar/subdomain/indicator counts, ISO3 key parity, `[0,100]` range, null discipline. *(A)*
- [ ] Re-confirm counts after fresh publish: 8 regions / 7 pillars / 17 subdomains / 28 indicators. *(T + A)*
- [ ] Frontend contract loader guards still match published shape (schema major version, year array). *(T)*
- [ ] Any contract change bumps `/v1` → `/v2` and updates `docs/data-contract.md` first. *(T + A — process check)*

**Done when:** published JSON passes validation and the frontend loads it without shape errors.

---

## Phase 7 — Security & secrets

- [ ] Confirm `.env` is gitignored and no secrets are committed (scan history). *(A)*
- [ ] Service principal least-privilege: storage SP writes Blob only; build identity scoped to ACR. *(A)*
- [ ] CORS allow-list on `dashboard-public` = production Wix domain + local dev origins only. *(A)*
- [ ] `Cache-Control: public, max-age=3600` on contract payloads (already set in publisher — verify on live Blob). *(A)*
- [ ] No secrets baked into the Docker image (verified by `.dockerignore`). *(A — verify)*

**Done when:** secrets stay out of git/images, identities are least-privilege, and CORS is locked to known origins.

---

## Phase 8 — Frontend build & polish

- [x] `npm run build` passes (tsc + vite). *(T)*
- [x] All 4 routes + TrendsPanel implemented with null/missing-data UX. *(T)*
- [x] Self-hosted world map TopoJSON (no CDN/CSP dependency). *(T, `5dab0f2`)*
- [ ] **Mock parity pass** vs `PlanCatalyst TSI Data Dashboard Final.html` — side-by-side each page, close visual/interaction gaps. *(T — not verified)*
- [ ] **Responsive QA** — phone / tablet / desktop / inside Wix iframe widths. *(T — not verified)*
- [ ] Verify dashboard against a **fresh fixture** (copy `data/organized/v1/` → `dashboard/public/v1/`); confirm popdens now renders. *(T)*
- [ ] Accessibility quick pass (contrast, focus states, alt text on map/legend). *(T)*
- [ ] Cross-browser smoke (Chrome, Safari, Firefox). *(T)*

**Done when:** the app matches the approved mock, is responsive at iframe widths, and renders the latest data.

---

## Phase 9 — Frontend hosting (Azure)

- [x] Choose host — **Azure Static Web Apps** (Free tier, `tsi-dashboard-frontend`, `rg tsi-data-dashboard`). *(T, `08d96e1`)*
- [x] `staticwebapp.config.json` — SPA fallback + CSP `frame-ancestors` for Wix/PlanCatalyst domains. *(T, `08d96e1`)*
- [x] Deploy `dist/` to SWA. Live URL: **`https://jolly-pebble-0e2f9300f.7.azurestaticapps.net`**. *(T, `08d96e1`)*
- [x] HTTPS via SWA (no custom domain needed for Wix iframe embed). *(T)*
- [ ] Set `VITE_CONTRACT_BASE_URL` to the prod Blob `/v1` URL and rebuild for prod. *(T — needs `dashboard-public` URL from A; currently uses local/fallback fixture)*
- [ ] Confirm hosted app fetches **live Blob JSON** (network tab shows `dashboard-public/v1/*.json`, 200s). *(T — blocked on A publishing to `dashboard-public`)*

**Done when:** the production frontend URL loads live data over HTTPS.

---

## Phase 10 — Wix integration & E2E

- [ ] Add HTML iframe embed in Wix pointing at the hosted frontend URL. *(T)*
- [ ] Verify iframe height / hash-sync behavior inside the live Wix page. *(T — sync code exists)*
- [ ] Confirm CORS allows the Wix origin (ties to Phase 7). *(A + T)*
- [ ] Full E2E on the published Wix page — all 4 routes load live data, interactions work, mobile + desktop. *(T)*
- [ ] Client review / sign-off from PlanCatalyst. *(T)*

**Done when:** the dashboard is live inside Wix, reading production data, and PlanCatalyst has signed off.

---

## Phase 11 — Testing & CI

- [ ] Unit tests for `publish_dashboard.py` pure builders (`build_meta`/`build_countries`/`build_timeseries`/`validate_payload`). *(A + T)*
- [ ] Scorer unit tests (esp. `DensityScorer`, threshold/ratio scorers, null handling). *(A)*
- [ ] Frontend tests — merge/refresh the Vitest branch; smoke-test contract loaders + key components. *(T)*
- [ ] CI workflow (`.github/workflows`) — run `npm run build`, frontend tests, Python tests, and a publish **dry-run validation** on PR. *(T + A — none exists today)*
- [ ] Branch hygiene — reconcile/merge stale branches (`antony-branch`, `christina-backend`, `fix/manifest-local-path`). *(A)*

**Done when:** PRs are gated by a green CI that builds the frontend and validates a dry-run contract.

---

## Phase 12 — Documentation & handoff

- [ ] Update `HANDOFF.md` + `TEAM-TASKS.md` to reflect publish-wired + popdens-fixed (gaps now closed). *(T)*
- [ ] Ops runbook: how to run, schedule, monitor, alert, and roll back. *(A)*
- [ ] `RUNNING.md` refresh — local setup, dry-run vs live, env vars. *(A)*
- [ ] Record final indicator coverage + any client-approved exceptions in `SCORING_AUDIT.md`. *(A)*

**Done when:** a new contributor can run, deploy, and recover the system from docs alone.

---

## Phase 13 — Launch / acceptance

- [ ] All Phase 0 Definition-of-Done items green.
- [ ] Final fresh publish + Wix E2E verified on the production page.
- [ ] PlanCatalyst sign-off recorded.
- [ ] Post-launch monitoring confirmed (one successful scheduled run observed end-to-end).

---

## Deferred / post-MVP

- [ ] Projections (`meta.projections.enabled === false`) — no MVP ship target.
- [ ] `conces` composite if PlanCatalyst defines a formula later.
- [ ] Additional WGI dimensions / extra World Bank indicators (config-only adds).
- [ ] Legacy 3-level compatibility CSVs — remove once confirmed unused.

---

## Critical path (shortest route to live)

1. **A (blocker):** grant ACR push rights → build/push image → pick pipeline execution host → first live publish to `dashboard-public/v1/`. Send **T** the prod `VITE_CONTRACT_BASE_URL`.
2. **T (unblocked):** set `VITE_CONTRACT_BASE_URL`, rebuild, redeploy to SWA, verify live JSON, embed in Wix → E2E.
3. **A:** schedule the pipeline run + alerting + rollback runbook.
4. **T + A:** add CI + tests during hardening; client sign-off.

> **Frontend hosting is done** (SWA: `https://jolly-pebble-0e2f9300f.7.azurestaticapps.net`).
> The only remaining blocker for T is A publishing live JSON to `dashboard-public/v1/`.
> Everything in **Phase 1 (verify), Phase 8 (mock parity / responsive)** is unblocked for **T** now.
