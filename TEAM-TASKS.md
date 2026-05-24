# Team Tasks - May Execution Plan

## Goal for May

Ship a near-complete, handoff-ready system where:

1. Backend publishes contract-compliant JSON (`meta.json`, `countries.json`, `timeseries.json`).
2. Frontend consumes only the published contract and reaches parity with `PlanCatalyst TSI Data Dashboard Final.html`.
3. Missing source coverage gaps are closed (or explicitly marked with approved placeholders).
4. Pipeline runs are repeatable (automation + validation + failure visibility).
5. Azure hosting and Blob integration are production-ready.

This plan is designed so work can continue autonomously through May while Thomas is out.

---

## Locked May Directives (No PM-Blocking Questions)

These directives are pre-approved so execution does not stall while Thomas is on vacation.

1. **Execution order:** repo hygiene and structure alignment come first, then feature implementation.
2. **Publish sequence:** Christina ships `publish_dashboard.py` in two phases:
   - Phase A: local `dry_run` generation + validation for `meta.json`, `countries.json`, `timeseries.json`.
   - Phase B: Azure upload path (`dashboard-public/v1/`) after dry-run validation is stable.
3. **Coverage requirement:** all 28 indicators must be live by **May 31**. Placeholder-only status is not acceptable at month-end.
4. **Frontend blueprint:** `PlanCatalyst TSI Data Dashboard Final.html` is the client-approved feature and UX blueprint. Keep parity tight unless compatibility constraints require change.
5. **Tech stack lock:** Azure Blob + custom React frontend only. Do not reintroduce Power BI, AWS, or BI-tool assumptions.
6. **Decision routing while PM is away:** Co-PM is default decision owner for unblockers. If a tradeoff affects contract semantics, Christina + Tyler decide and record in docs.

---

## Team Allocation

- Frontend Design/UI: **Adeline**
- Frontend Integration + Backend/API integration: **Christina**
- Data Cleaning: **Tyler**
- Data Processing Projections (data science): **Kayden**
- Source Coverage (new data ingestion): **Caroline**
- Cloud/Azure + platform integration: **Co-PM (Azure owner)**

---

## Non-Negotiable Invariants

1. `docs/data-contract.md` is the frontend/backend contract source of truth.
2. Frontend must not bypass published JSON to read pipeline internals directly.
3. Contract versioning is enforced (`/v1/` now; breaking changes require `/v2/`).
4. Scores delivered to frontend are `higher_is_better`.
5. `iso3` is canonical join key across all payloads.
6. Missing data is `null`, never omitted keys or sentinel `0` values.
7. The current stack is Azure Blob plus a custom React frontend. Do not reintroduce Power BI, AWS, or BI-tool frontend assumptions.

---

## Known Implementation Gaps to Close

These gaps block a fully contract-compliant `/v1/` publish and must be tracked during May:

1. `src/upload/publish_dashboard.py` is a contract skeleton and must be implemented before the frontend can rely on live Blob JSON.
2. ~~`ndgain` has component data, but the ND-GAIN Vulnerability Index composite still needs to be produced and wired to `ND_GAIN_VULN`.~~ **Closed 2026-05-17** — pipeline now reads ND-GAIN's published `vulnerability.csv` composite directly.
3. ~~`gii` and `mpi` need UNDP Human Development Reports ingestion and cleaning paths.~~ **Closed 2026-05-17** — both live via the new `UNDPHDRFetcher` / `UNDPHDRCleaner` pair against 2025 HDR composite-indices CSV and 2025 OPHI Global MPI Table 2.
4. ~~`state` needs a State Capacity Index source path, cleaner, scorer/factory wiring, and taxonomy mapping.~~ **Closed 2026-05-17** — source switched from stale Hanson-Sigman (frozen 2015) to World Bank WGI Government Effectiveness (current through 2024); `WGI_GOVEFF` series wired via new `WBWGIFetcher` / `WBWGICleaner` pair.
5. **`conces` — future task (deferred 2026-05-17).** Inputs (WB + IMF series) exist but the Concessionality Index is a PlanCatalyst-defined composite whose formula is not specified in `indicators/indicators.yaml`. Six open methodology questions documented in `docs/source-candidates.md` need PlanCatalyst answers before any code goes in. Once the formula is pinned down, implementation is ~1 day on the now-established WB/file-composite patterns. Owner: PM to route to PlanCatalyst, then back to data-coverage owner.
6. `popdens` has a mapping/scoring mismatch to reconcile: taxonomy currently maps to `EN.POP.DNST`, while scorer registration historically used `POP_DENSITY`; the canonical series code and banded formula must be made consistent. Additionally, the World Bank cleaner does not yet emit a `series_code` column so popdens rows are defensively dropped by the scoring pipeline as of 2026-05-17 — quick fix once the canonical series_code is agreed.
7. Repo structure must stay aligned with imports and docs: upload code lives in `src/upload/`, active settings live in `src/config/settings.yaml`, and duplicate root-level config/upload copies should not be used.
8. **Stale on-disk UN SDG cleaned CSV (2026-05-17 discovery)** — `data/clean/unsdg/un_sdg_clean.csv` uses numeric UN M49 country codes (e.g. `4` for Afghanistan) instead of ISO3, even though the current cleaner code does the ISO3 mapping. The file was written before that fix landed. Tyler: re-run `python3 -m src.clean.clean_data` (or full pipeline) to refresh. Until then, UN SDG poverty rows do not join with new ISO3-keyed rows (MPI, GII, WGI, ND-GAIN) at the subdomain rollup.

---

## Owner Plans

## 1) Adeline - Frontend Design and UX Parity

### Mission

Convert `PlanCatalyst TSI Data Dashboard Final.html` into production React UI with consistent visual system, responsive behavior, and clear states for missing/projection data.

### Deliverables

1. Design parity spec (component-by-component) against `PlanCatalyst TSI Data Dashboard Final.html`.
2. Finalized page/component set for:
  - Explore
  - Compare
  - Map
  - About
3. State design for:
  - Loading
  - Empty/no-data
  - Error/retry
  - Projections disabled banner
4. Responsive QA pass (desktop/tablet/mobile) with fix list closed.
5. Design token documentation (colors, spacing, typography, chart theming).

### Definition of Done

- All primary flows render without visual regressions versus mock intent.
- No unresolved UX ambiguity for nulls, unavailable indicators, or disabled projections.
- Christina can integrate data without changing intended visual hierarchy.

### Dependencies

- Contract field names and semantics from `docs/data-contract.md`.
- Indicator and pillar labels from `meta.json`.
- Frontend implementation constraints from `docs/frontend-implementation-brief.md`.

---

## 2) Christina - Frontend Integration + Backend/API Integration

### Mission

Own contract integration end-to-end: frontend data wiring plus backend publish/API integration work needed to serve contract JSON from Blob.

### Deliverables

1. Typed loader layer for:
  - `meta.json`
  - `countries.json`
  - `timeseries.json`
2. Runtime contract guards (shape/version validation, graceful fail for mismatch).
3. Frontend data context/store with caching and error boundaries.
4. View integrations:
  - Explore table + sparkline trend support
  - Compare multi-country logic
  - Map choropleth + country drilldown
  - Detail chart (timeseries by indicator)
5. Iframe integration:
  - `postMessage` height sync
  - URL/hash state preservation
6. Backend/API integration ownership:
  - Implement `src/upload/publish_dashboard.py` TODOs (input loading, builders, validation, versioned write).
  - Keep publish output strictly aligned with `docs/data-contract.md`.
  - Define publish failure/error responses usable by operations.
  - Ensure publish emits `meta.json`, `countries.json`, and `timeseries.json` only after validation passes.
7. Test coverage for parsing/transform helpers and key state transitions.

### Definition of Done

- App boots from Blob JSON only (no local hardcoded dataset path in production mode).
- Any schema mismatch is surfaced clearly and does not white-screen the app.
- All major views use contract data with deterministic behavior.
- Publish pipeline outputs contract-valid `/v1/*.json` without manual post-processing.

### Dependencies

- Adeline's final component behavior/state specs.
- Tyler's scoring/cleaning-ready datasets and schema guarantees.
- Co-PM's Blob/CORS configuration.

---

## 3) Tyler - Data Cleaning Reliability and Compatibility

### Mission

Make cleaned/scored backend inputs stable and compatible, and co-own pipeline assembly with Christina.

### Deliverables

1. Cleaning rule audit by source (UN SDG, World Bank, ND-GAIN, new sources).
2. Explicit null-handling and coercion rules documented and enforced.
3. Country identity reconciliation:
  - Confirm alignment to `indicators/country_codes.csv`.
  - Resolve naming/iso mismatches before scoring stage.
4. Cleaning validation checks:
  - Required columns present
  - Type checks
  - Year bounds
  - Duplicate key detection
5. Data quality report per run (counts, dropped rows, unresolved anomalies).
6. Pipeline/backend co-ownership with Christina:
  - Ensure scoring/aggregation outputs needed by publish are emitted consistently.
  - Add/maintain scoring and pipeline validation checks before publish.
  - Provide stable intermediate artifacts and schemas for Christina's publish builder.
  - Reconcile the `popdens` series-code/scoring mismatch with Caroline and Christina.

### Definition of Done

- Cleaning runs without manual patching.
- Downstream scoring receives normalized, schema-consistent inputs.
- Known edge cases are either resolved or explicitly logged with owner/action.
- Christina can consume Tyler's outputs directly in publish with no ad hoc column fixes.

### Dependencies

- Source ingestion output formats from Data Coverage Developer.
- Publish integration expectations from Christina.

---

## 4) Kayden - Projections (Data Science Only)

### Mission

Own projections research and implementation from cleaned data only. No backend, pipeline orchestration, API, or infrastructure ownership.

### Deliverables

1. Build projection datasets from cleaned/scored historical series (where data density supports it).
2. Compare projection methods and document selected baseline(s) with rationale.
3. Generate projection quality report:
  - coverage by indicator/country
  - confidence/limitations
  - indicators not suitable for projection
4. Produce projection-ready output spec for future contract extension (post-MVP).
5. Document clear "ship/no-ship" recommendation for enabling projections in UI.

### Definition of Done

- Projection outputs are reproducible from cleaned/scored inputs.
- Method choice and limitations are documented and reviewable by PMs.
- A defensible recommendation exists for what can be enabled safely in a future release.

### Dependencies

- Tyler's cleaned, reconciled inputs.
- Christina/Tyler-provided scored historical outputs.

---

## 5) Caroline - Source Gap Closure

### Mission

Close source coverage gaps blocking full indicator completeness for the data contract.

### Deliverables

1. Implement/land missing source ingestion for:
  - UNDP HDR source coverage for `gii` and `mpi`
2. Complete ND-GAIN composite production path:
  - Build aggregate vulnerability score needed by `ndgain`
3. Define and implement source path for:
  - `state` (State Capacity Index)
  - `conces` (Concessionality Index)
4. Confirm canonical non-SDG series codes with Tyler/Christina:
  - `GII_INDEX`
  - `MPI_INDEX`
  - `ND_GAIN_VULN`
  - population density (`EN.POP.DNST` or a documented normalized alias)
  - `state`
  - `conces`
5. For each new source:
  - Fetch module
  - Cleaning mapping
  - Provenance note (source URL/version/date)
  - Sample output verification
6. Coverage tracker update:
  - Indicator-by-indicator status: complete / partial / blocked
7. Use client-front-end-aligned source intent as default:
  - `gii` / `mpi`: UNDP Human Development Reports
  - `ndgain`: University of Notre Dame ND-GAIN country index
  - `state`: Our World in Data (state capacity source path)
  - `conces`: World Bank / IMF-derived concessionality construction

### Definition of Done

- All 28 indicators have either:
  - live source + scoring path, or
  - documented approved temporary placeholder status with ETA/owner.
- No silent all-null indicators without explicit status in tracker.

### Dependencies

- Tyler for cleaning normalization.
- Christina/Tyler for scorer/factory wiring and publish integration.

---

## 6) Co-PM (Azure Owner) - Cloud Platform, Deployment, Automation

### Mission

Own Azure setup and reliability so backend publish + frontend consumption work in hosted environments without manual intervention.

### Deliverables

1. Storage/container setup:
  - `dashboard-public` (versioned JSON path, anonymous read)
  - validated private container for backend artifacts
2. Security and access:
  - Service principal scopes
  - Secret management and rotation plan
  - CORS allow-list for Wix + local dev hosts
3. Hosting/integration:
  - Confirm frontend hosting target (Static Web Apps vs Blob `$web`)
  - Ensure frontend can fetch from `dashboard-public/v1/`
4. Automation:
  - Scheduled pipeline run (biannual schedule + manual trigger option)
  - Publish step included in pipeline
  - Job-level alerting/notifications on failure
5. Ops runbook:
  - rollback procedure for bad publish
  - schema version cutover procedure (`/v1/` -> `/v2/`)

### Definition of Done

- Hosted frontend can read contract JSON in production.
- Pipeline + publish can run unattended with observable success/failure.
- Operational ownership docs exist for on-call/recovery.

### Dependencies

- Christina/Tyler for publish behavior and artifact paths.
- Christina for frontend fetch environment requirements.

---

## Cross-Team Integration Milestones (May)

## Week 1 (Foundation)

- Freeze contract assumptions (`docs/data-contract.md`) for May.
- Finish repo hygiene: keep upload modules under `src/upload/`, use `src/config/settings.yaml`, and remove stale root-level copies.
- Christina sets up typed loaders + skeleton views.
- Christina starts `publish_dashboard.py` implementation; Tyler aligns required upstream outputs.
- Data Coverage Developer begins UNDP/ND-GAIN/state/conces source implementation.
- Tyler/Caroline/Christina decide and document the canonical `popdens` series code and scoring formula.
- Co-PM provisions target Azure containers and access model.

## Week 2 (Data Completeness and Wiring)

- Tyler finalizes cleaning normalization and validation checks.
- Christina integrates real cleaned/scored inputs into publish with Tyler.
- Christina connects Explore + Compare to real contract payloads.
- Adeline closes primary interaction and responsive behavior gaps.

## Week 3 (E2E Stabilization)

- First full end-to-end run to `/v1/` JSON in Azure test path.
- Contract validation failures triaged and resolved same week.
- Source gap closure status reviewed against 28-indicator target.
- Map/detail chart parity pass completed.

## Week 4 (Hardening and Handoff Readiness)

- Reliability pass: retries, error handling, alerts.
- Final QA across frontend states and data edge cases.
- Documentation refresh (runbooks, setup, known limitations).
- Decide go/no-go:
  - complete launch-ready
  - or near-complete with explicit carry-over list.

---

## Reporting Cadence (while Thomas is out)

- Twice-weekly async written updates from each owner:
  - Done since last update
  - Next planned
  - Blockers + requested decisions
- Weekly integration checkpoint across all owners.
- Blockers older than 48 hours escalate to Co-PM for decision routing.

---

## Completion Criteria for End of May

Target outcome is "complete" or "near-complete with bounded carry-over":

1. Frontend reads contract JSON from Azure in hosted environment.
2. Publish pipeline generates and validates all three JSON files.
3. Indicator coverage is fully implemented or explicitly exception-tracked.
4. Automated run + alerting exists and is tested.
5. Remaining work (if any) is documented with owner, ETA, and risk.

---

## Known Risk Register (Track Weekly)

1. New-source delays (UNDP/state/conces definitions).
2. Scoring mismatch risk for ambiguous indicators (especially `popdens` and index constructs).
3. Schema drift between frontend assumptions and publish output.
4. Azure permission/CORS misconfiguration delaying integration.
5. Hidden data quality issues surfacing late in E2E tests.

Each risk must have: owner, mitigation, trigger, fallback.