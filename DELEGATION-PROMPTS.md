# Delegation Prompts — fresh-chat task handoffs

> Copy one fenced block at a time into a **new chat** (fresh context). Each prompt
> is self-contained: it tells the agent what to read, what to do, which files are
> involved, and how to decompose the work into sub-agents (the `Task` tool:
> `explore` = readonly recon, `generalPurpose` = implementation, `shell` = command
> execution).
>
> Tracking: `DELIVERY-CHECKLIST.md`. Contract truth: `docs/data-contract.md`.
> Always-read context: `CLAUDE.md`.

---

## 1 — Pipeline end-to-end verification & data-quality closeout  *(owner: Thomas)*

```text
You are working in the PlanCatalyst TSI Data Dashboard repo. Read CLAUDE.md,
DELIVERY-CHECKLIST.md (Phase 1), and indicators/SCORING_AUDIT.md before acting.

OBJECTIVE
Prove the pipeline runs fetch -> clean -> score -> publish end-to-end locally and
that the recently-fixed popdens + publish wiring actually produce valid contract
JSON. Close the remaining data-quality gaps.

KEY FILES & MODULES
- Orchestration: src/pipeline/orchestrator.py, src/pipeline/run_pipeline.py
- Clean: src/clean/world_bank_clean.py (popdens series_code fix), src/clean/un_sdg_clean.py
- Score: src/calculating/pipeline.py, factory.py, scorers.py, pillar_aggregate.py, pillar_taxonomy.py
- Publish: src/upload/publish_dashboard.py (build_meta/countries/timeseries, validate_payload)
- Config: src/config/settings.yaml (runtime.fetch_raw, upload_azure, publish_dashboard)
- Data: data/clean/, data/interim/validated/, data/organized/v1/
- Helper: scripts/refetch_and_rescore.py
- Taxonomy: indicators/indicators.yaml, indicators/country_codes.csv

TASKS
1. Set up the Python env (python3 -m venv .venv; pip install -r requirements.txt).
2. Run `python -m src.pipeline.run_pipeline` with runtime.fetch_raw: false and
   upload_azure: false. Confirm it dry-runs publish to data/organized/v1/.
3. Inspect data/organized/v1/{meta,countries,timeseries}.json: confirm 8 regions /
   7 pillars / 17 subdomains / 28 indicators, and that popdens (EN.POP.DNST) now
   carries non-null values for some countries.
4. Verify ISO3 join health: no M49 numeric codes leak into published country keys.
5. Review the popdens DensityScorer formula vs the banded formula in
   indicators.yaml (SCORING_AUDIT.md row 27); recommend the canonical one.
6. Produce a conces recommendation: client formula needed vs MVP exclusion +
   SCORING_AUDIT.md exception text.
7. Spot-check ~5 countries across pillars against source values; flag anomalies.

SUB-AGENT ARCHITECTURE
- Sub-agent A (explore, readonly): map the current scoring/publish data flow and
  list exactly where series_code/ISO3 transformations happen. Run first.
- Sub-agent B (shell): set up venv, run the pipeline, capture logs/output paths.
- Sub-agent C (generalPurpose): given B's output, validate the JSON, run the
  spot-checks, and draft the SCORING_AUDIT.md updates.
- Run A and B in parallel (A informs review, B produces artifacts); C is sequential
  after B. Keep edits out of A.

CONSTRAINTS
- Do not invert scores anywhere except publish_dashboard.py (100 - x).
- Missing data stays null. Never coerce to 0.
- Do not enable Azure upload.

DELIVERABLES
A working local end-to-end run, a short verification report (counts, popdens
status, anomalies), and proposed SCORING_AUDIT.md edits for popdens + conces.
```

---

## 2 — Backend hosting: Docker/ACR push + first live publish  *(owner: Anthony)*

```text
You are working in the PlanCatalyst TSI Data Dashboard repo. Read CLAUDE.md,
DELIVERY-CHECKLIST.md (Phases 2 & 7), and docs/docker.md before acting.

OBJECTIVE
Get the containerized pipeline pushed to Azure Container Registry, choose an
execution host, and produce the first live publish to dashboard-public/v1/.

KEY FILES & MODULES
- Container: Dockerfile, .dockerignore, scripts/acr_build.sh, docs/docker.md
- Pipeline entrypoint: src/pipeline/run_pipeline.py
- Upload/publish: src/upload/upload_validated.py, src/upload/publish_dashboard.py
- Config: src/config/settings.yaml (azure.*, publish.*, runtime.upload_azure)
- Secrets: .env (ACR_NAME, ACR_LOGIN_SERVER, RESOURCE_GROUP, LOCATION, AZURE_*)

TASKS
1. Resolve the ACR push blocker: the storage-only service principal lacks registry
   rights. Grant Contributor scoped to registry TSIcontainers (needs Owner / User
   Access Administrator). See docs/docker.md "One-time permission grant".
2. Build + push the image via scripts/acr_build.sh; verify tags with
   `az acr repository show-tags -n TSIcontainers --repository tsi-pipeline -o table`.
3. Choose an execution host: Azure Container Instances vs Container Apps Job vs
   scheduled VM. Document the trade-off and pick one.
4. Deploy with AZURE_* injected at runtime (never baked into the image).
5. Run with runtime.fetch_raw: true and upload_azure: true to publish a fresh
   /v1/ snapshot to dashboard-public.
6. Confirm container access policies: dashboard-public is public-read,
   validated-scores stays private. Set CORS allow-list (prod Wix + local dev).

SUB-AGENT ARCHITECTURE
- Sub-agent A (explore, readonly): audit Dockerfile + acr_build.sh + .env contract
  and produce the exact az CLI command sequence for grant/build/deploy.
- Sub-agent B (shell): execute the az/docker commands A produced (needs Azure auth;
  run with elevated network/permissions). Sequential after A.
- Keep this single-threaded: each step depends on the previous (grant -> push ->
  deploy -> publish). Do not parallelize Azure mutations.

CONSTRAINTS
- Never commit .env or bake secrets into the image.
- A failed publish must not overwrite the last good /v1/ snapshot (publisher writes
  manifest.json last — verify this holds).

DELIVERABLES
Image in ACR, a chosen+documented execution host, a live dashboard-public/v1/
snapshot, locked container access + CORS, and the prod Blob /v1 base URL handed to
the frontend owner.
```

---

## 3 — Automation, scheduling & ops (alerting, rollback, observability)  *(owner: Anthony)*

```text
You are working in the PlanCatalyst TSI Data Dashboard repo. Read CLAUDE.md and
DELIVERY-CHECKLIST.md (Phases 3 & 5). Assumes Prompt 2 (hosting) is done.

OBJECTIVE
Make the pipeline run unattended on a schedule, observable, alertable, and
recoverable.

KEY FILES & MODULES
- Pipeline: src/pipeline/orchestrator.py, src/pipeline/run_pipeline.py
- Logging utils: src/pipeline/terminal_output.py, src/pipeline/utils.py
- Publish: src/upload/publish_dashboard.py (manifest/atomic publish)
- Config: src/config/settings.yaml
- Container/host config from Prompt 2

TASKS
1. Add a scheduled trigger on the chosen host (cron / Container Apps Job schedule /
   Logic App). Decide cadence with the PM (monthly/quarterly/on-update).
2. Document a manual trigger path for ad-hoc refresh.
3. Add structured run logging: run id, per-stage timing, row counts, skipped series.
4. Wire failure alerting (email / Slack / Azure Monitor) for pipeline + publish
   failures.
5. Write a rollback runbook: how to restore the previous /v1/ snapshot.
6. Add snapshot retention/versioning for published payloads.
7. Verify idempotency: re-running with no new upstream data does not corrupt or
   partially publish.

SUB-AGENT ARCHITECTURE
- Sub-agent A (explore, readonly): inventory current logging + the publish
  atomicity mechanism; identify where to inject run-id + metrics.
- Sub-agent B (generalPurpose): implement logging/alert hooks in the pipeline code.
- Sub-agent C (shell): configure the Azure schedule + alert rules.
- B and C run in parallel after A; the rollback runbook is authored last using
  both outputs.

DELIVERABLES
A scheduled unattended run, structured logs, failure alerts, a written rollback
runbook, and a verified idempotent re-run.
```

---

## 4 — Reliability & stress-testing harness + Python tests  *(owner: Anthony + Thomas)*

```text
You are working in the PlanCatalyst TSI Data Dashboard repo. Read CLAUDE.md and
DELIVERY-CHECKLIST.md (Phases 4 & 11). No test suite exists yet.

OBJECTIVE
Error-proof the pipeline by exercising known failure modes and adding a Python
test suite around the load-bearing pure functions.

KEY FILES & MODULES
- Fetch resilience: src/fetch/fetch_handler.py, world_bank_fetch.py, un_sdg_fetch.py
- Clean: src/clean/*_clean.py (malformed-input handling)
- Score: src/calculating/scorers.py, factory.py, pillar_aggregate.py, pipeline.py
- Publish/validate: src/upload/publish_dashboard.py (validate_payload is the gate)
- New: tests/ (create), requirements.txt (add pytest)

TASKS
1. Create tests/ with pytest. Add unit tests for:
   - publish_dashboard builders (build_meta/build_countries/build_timeseries) and
     validate_payload (must reject wrong counts, bad ISO3 parity, out-of-range,
     non-null sentinels).
   - scorers.py (DensityScorer, RatioThreshold/InverseRatio, null handling, clamp).
2. Fault-injection / stress scenarios (as tests or a scripts/ harness):
   - upstream source times out / returns 5xx -> retry then graceful skip vs hard fail.
   - one dead source must not blank unrelated pillars (per-source isolation).
   - malformed inputs: empty CSV, missing columns, NaN floods, duplicate rows,
     unexpected country codes.
   - publish atomicity: simulate mid-publish failure, confirm prior snapshot survives.
   - feed validate_payload a deliberately broken payload, confirm upload aborts.
3. Document the failure policy (recover vs fail-safe) in the ops notes.

SUB-AGENT ARCHITECTURE
- Sub-agent A (explore, readonly): map current retry/skip behavior and every place
  a row can be silently dropped; produce the failure-mode matrix.
- Sub-agent B (generalPurpose): write unit tests for builders + scorers.
- Sub-agent C (generalPurpose): write the fault-injection/stress tests.
- B and C run in parallel after A. A shell sub-agent runs the suite and reports.

CONSTRAINTS
- Tests must not hit live APIs or Azure; mock/fixture all I/O.

DELIVERABLES
A passing pytest suite, a fault-injection harness, a documented failure-mode matrix,
and confirmation that a bad payload never publishes.
```

---

## 5 — Frontend mock-parity & responsive QA  *(owner: Thomas)*

```text
You are working in the PlanCatalyst TSI Data Dashboard repo (React + TS + Vite in
dashboard/). Read CLAUDE.md and DELIVERY-CHECKLIST.md (Phase 8).

OBJECTIVE
Close visual/interaction gaps between the live app and the client-approved mock,
and make it responsive at the widths it will run inside a Wix iframe.

KEY FILES & MODULES
- Mock (source of truth): "PlanCatalyst TSI Data Dashboard Final.html" (repo root)
- Routes: dashboard/src/app/routes/{ExplorePage,ComparePage,MapPage,AboutPage,TrendsPanel}.tsx
- Components: dashboard/src/components/** (charts/, map/, panels/, scores/, states/, tables/)
- Styles: dashboard/src/**/*.css (and inline styles in components)
- Data context: dashboard/src/state/dashboard-context.tsx
- Local fixtures: dashboard/public/v1/ (refresh from data/organized/v1/ first)

TASKS
1. Refresh the local fixture: copy data/organized/v1/* into dashboard/public/v1/ so
   QA runs against current data (popdens populated). Run `npm run dev`.
2. Open the mock HTML and the running app side by side. For each of the 4 pages +
   TrendsPanel, produce a punch list of visual/interaction differences.
3. Fix the gaps (spacing, colors, typography, hover/tooltip behavior, sort/filter).
4. Responsive QA at phone / tablet / desktop AND typical Wix iframe widths; fix
   overflow, wrapping, and chart scaling.
5. Accessibility quick pass (contrast, focus states, map/legend alt text).
6. Re-run `npm run build` to confirm no regressions.

SUB-AGENT ARCHITECTURE
- Sub-agent A (explore, readonly): diff the mock HTML structure/styles against the
  current components; emit a per-page gap punch list. Run first.
- Sub-agent B (generalPurpose): implement fixes page-by-page from A's punch list.
- Optionally use the playwright-cli skill / screenshots to compare renders.
- A is recon-only; B does all edits sequentially after A.

CONSTRAINTS
- Frontend reads only /v1/*.json. Never read pipeline CSVs.
- Keep null/missing-data UX intact (dashes, deferred badges) — do not render 0s.

DELIVERABLES
A per-page parity punch list, the implemented fixes, responsive behavior verified at
iframe widths, and a green `npm run build`.
```

---

## 6 — Frontend hosting on Azure + Wix E2E + CORS  *(owner: Anthony + Thomas)*

```text
You are working in the PlanCatalyst TSI Data Dashboard repo. Read CLAUDE.md and
DELIVERY-CHECKLIST.md (Phases 9 & 10). Requires the prod Blob /v1 URL from Prompt 2.

OBJECTIVE
Host the built frontend on Azure, point it at live Blob data, embed it in Wix, and
verify end-to-end.

KEY FILES & MODULES
- Build config: dashboard/vite.config.*, dashboard/package.json
- Env: dashboard/.env.example -> dashboard/.env.local (VITE_CONTRACT_BASE_URL)
- Loader: dashboard/src/data/contract/loaders.ts (probes base URL, falls back to /v1)
- Iframe sync: search dashboard/src for the Wix height/hash post-message code
- Output: dashboard/dist/

TASKS
1. Set VITE_CONTRACT_BASE_URL to the prod Blob /v1 and run `npm run build`.
2. Choose a host (Azure Static Web Apps vs Blob $web) and deploy dist/.
3. Confirm the hosted app fetches live JSON (network tab shows dashboard-public/v1/*
   returning 200).
4. Ensure HTTPS + custom domain if Wix requires it.
5. Add an HTML iframe embed in Wix pointing at the hosted URL; verify height/hash
   sync inside the live Wix page.
6. Confirm CORS on dashboard-public allows the Wix origin + local dev only.
7. Full E2E on the Wix page: all 4 routes load live data, interactions work, mobile
   + desktop.

SUB-AGENT ARCHITECTURE
- Sub-agent A (explore, readonly): confirm how loaders.ts resolves the base URL and
  locate the iframe sync code; produce the exact build + env steps.
- Sub-agent B (shell): build with the prod URL and deploy to the chosen host.
- Sub-agent C (shell, Azure): configure CORS + HTTPS/domain.
- B and C can run in parallel after A. Wix embed + E2E is a manual final step.

DELIVERABLES
A live HTTPS frontend reading prod Blob data, embedded in Wix, with CORS locked and
a passing E2E walkthrough.
```

---

## 7 — CI harness (build + tests + dry-run contract validation)  *(owner: Thomas + Anthony)*

```text
You are working in the PlanCatalyst TSI Data Dashboard repo. Read CLAUDE.md and
DELIVERY-CHECKLIST.md (Phase 11). No CI exists today (.github/workflows is absent).

OBJECTIVE
Gate every PR with a green CI: frontend build, frontend + Python tests, and a
publish dry-run contract validation.

KEY FILES & MODULES
- New: .github/workflows/ci.yml
- Frontend: dashboard/ (npm run build; vitest once the test branch is merged)
- Python: tests/ (from Prompt 4), requirements.txt
- Publish validation: src/upload/publish_dashboard.py (dry-run -> data/organized/v1/
  then validate_payload over the output)
- Branches to reconcile: antony-branch, christina-backend, fix/manifest-local-path

TASKS
1. Add a GitHub Actions workflow that on PR:
   - installs Python deps, runs pytest.
   - installs frontend deps, runs `npm run build` and frontend tests.
   - runs a publish dry-run and asserts validate_payload passes on the output.
2. Make failures block merge.
3. Reconcile/merge or delete stale branches so main is the single line of work.

SUB-AGENT ARCHITECTURE
- Sub-agent A (explore, readonly): inventory build/test commands and the dry-run
  invocation; confirm exact paths/outputs.
- Sub-agent B (generalPurpose): author ci.yml from A's inventory.
- Sub-agent C (shell): branch reconciliation (report diffs; do not force-push).
- B and C run in parallel after A.

CONSTRAINTS
- CI must not require Azure secrets for the dry-run path (publish dry-run writes
  locally and needs no credentials).

DELIVERABLES
A merge-gating CI workflow (build + tests + dry-run validation) and a cleaned-up
branch list.
```

---

## Suggested execution order

1. **Now, in parallel:** Prompt 1 (pipeline verify, T) and Prompt 5 (frontend QA, T)
   — both unblocked, no Azure needed.
2. **Anthony:** Prompt 2 (hosting) — unblocks the prod URL.
3. **After URL:** Prompt 6 (frontend hosting + Wix).
4. **Hardening, in parallel:** Prompt 3 (automation/ops), Prompt 4 (reliability/tests),
   Prompt 7 (CI).
