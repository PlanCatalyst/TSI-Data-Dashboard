# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mission

Deliver a reliable backend-to-frontend contract for the PlanCatalyst dashboard:

1. Fetch and normalize source data (UN SDG, World Bank, ND-GAIN, ...).
2. Score and aggregate by the 7-pillar taxonomy.
3. Publish versioned JSON payloads (`meta.json`, `countries.json`, `timeseries.json`) to Azure Blob.
4. Serve those payloads to a React frontend embedded in Wix.

The dashboard is a decision-support product for identifying country-level need. It is **not** an impact attribution system.

## Repository Layout

Two top-level deliverables in one repo:

- **`src/`** — Python data pipeline (the backend). Stages: `fetch/`, `clean/`, `calculating/`, `upload/`, orchestrated by `pipeline/`. Config lives in `src/config/settings.yaml`.
- **`dashboard/`** — React + TypeScript + Vite frontend. Reads only the published contract JSON; never reads pipeline CSVs. Page routes live in `dashboard/src/app/routes/` (`AboutPage`, `ComparePage`, `ExplorePage`, `MapPage`, `TrendsPanel`); shared UI in `dashboard/src/components/` (`charts/`, `map/`, `panels/`, `states/`, `tables/`); contract loaders in `dashboard/src/data/`.
- **`indicators/`** — taxonomy source of truth: `indicators.yaml` (pillar/subdomain/indicator hierarchy), `country_codes.csv` (canonical name + iso3 + numeric id), `SCORING_AUDIT.md` (scoring direction + known gaps).
- **`docs/`** — `data-contract.md` (authoritative payload schema), `PRINCIPLES.md`, `repo-architecture.md`.
- **`scripts/`** — ad-hoc utilities (one-off conversions, debugging helpers). Not part of the production pipeline; safe to edit without contract concerns.
- **`data/`** — local-only artifacts: `raw/` (per-source raw payloads), `clean/` (per-source cleaned CSVs), `interim/validated/` (scored), `organized/` (local pre-publish JSON in `dry_run`).

## Common Commands

### Python pipeline (from repo root)

```zsh
# One-time setup
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run end-to-end pipeline (fetch -> clean -> score -> upload)
python3 -m src.pipeline.run_pipeline

# Run only the scoring/aggregation stage against existing cleaned CSVs
python3 -m src.calculating.pipeline

# Run only the cleaning stage against existing data/raw/ (debug mode)
python3 -m src.clean.clean_data
```

### Frontend (from `dashboard/`)

```zsh
npm install
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm run preview  # preview built bundle
```

See `RUNNING.md` at repo root for the full local-setup walkthrough (Python venv, `.env` values, frontend dev server, dry-run vs. live-publish toggles).

### Tests/Lint

There is currently no test runner or linter wired up in this repo (no `pytest`, `ruff`, `eslint`, or CI config). Don't claim test coverage; if a change needs verification, run the relevant pipeline stage and inspect the CSV/JSON output.

## Pipeline Architecture

```
fetch -> clean -> score/aggregate -> publish contract JSON -> Azure Blob -> React frontend -> Wix iframe
```

Stages are orchestrated by `src/pipeline/orchestrator.py` (entered via `src/pipeline/run_pipeline.py`):

1. **Fetch** (`src/fetch/`) — abstract-factory clients hit UN SDG, World Bank, and ND-GAIN. Per-source raw payloads land under `data/raw/<source>/` when `runtime.save_raw: true`.
2. **Clean** (`src/clean/`) — same factory pattern; outputs tidy per-source CSVs under `data/clean/<source>/`.
3. **Calculating** (`src/calculating/`) — `pipeline.run_pipeline` reads cleaned UN SDG CSV, applies per-`series_code` scorers via `IndicatorScorerFactory`, then aggregates to subdomain and pillar via `pillar_aggregate.py`. Writes `Indicator_Scores_Full.csv`, `indicatorscores/*.csv`, `subdomainscores.csv`, `pillarscores.csv` under `data/interim/validated/`.
4. **Upload** (`src/upload/upload_validated.py`) — pushes the validated CSVs to the private Azure container (`validated-scores`) when `runtime.upload_azure: true`.
5. **Publish** (`src/upload/publish_dashboard.py`) — **partially implemented; signatures are the binding contract, internals are in flight (Christina).** `build_meta` / `build_countries` / `build_timeseries` have working bodies and the `NotImplementedError` raises are commented out, but the end-to-end `publish()` path (validation gate + atomic blob swap into `dashboard-public/v1/`) is not yet trusted for production. Treat it as fixture-generation quality, not production-ready. The frontend reads only the three files this module emits.

### The publish boundary is the only place orientation flips

The pipeline emits **vulnerability-oriented** scores ("higher = more need") all the way through `data/interim/validated/`. The publish step converts to dashboard orientation (`higher_is_better`) via `published = round(100 - pipeline_score, 1)`. Do not invert anywhere else; do not "fix" scorers in `src/calculating/` to flip direction. See `indicators/SCORING_AUDIT.md`.

### Indicator taxonomy bridges two naming worlds

`src/calculating/pillar_taxonomy.py` is the single source mapping:

- yaml/frontend world: `frontend_key` (e.g. `"uhc"`, `"tb"`) inside `health, ag, si, women, climate, ctx, pri`.
- pipeline world: source-specific `series_code` (e.g. `"SH_ACS_UNHC_25"`, `"EN.POP.DNST"`).

SDG indicators bridge automatically through `SDG_ID_TO_SERIES_CODE`; non-SDG indicators (gii, ndgain, mpi, popdens, state, conces) bridge through `NON_SDG_FRONTEND_KEY_TO_SERIES_CODE`. When wiring a new source, add its `series_code` to one of these maps so pillar aggregation picks it up automatically.

## Key Dev-Loop Knobs (`src/config/settings.yaml`)

- `runtime.fetch_raw: false` — skip API calls, reuse existing `data/raw/` files. **Default in this repo; set to `true` only when fetching fresh upstream data.** UN SDG fetch is slow and rate-limited; avoid unnecessary re-fetches.
- `runtime.upload_azure: false` — disable Azure upload for local dry runs.
- `runtime.save_raw` / `runtime.save_cleaned` — control whether raw/clean CSVs persist to disk between stages.
- `runtime.interim_data.<source>` — paths to cleaned CSVs that downstream stages consume.
- `azure.container_name` (`validated-scores`) vs `publish.dashboard_container_name` (`dashboard-public`) — backend artifacts vs frontend payloads. They are different containers with different access policies.

Azure auth: `.env` at repo root with `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_STORAGE_ACCOUNT_URL`. Never commit `.env`.

## Source of Truth Hierarchy

When documents disagree, resolve in this order (lower number wins):

1. `docs/data-contract.md` (payload schema and semantics)
2. `indicators/indicators.yaml` (indicator taxonomy and metadata)
3. `indicators/SCORING_AUDIT.md` (scoring direction and known gaps)
4. `TEAM-TASKS.md` (current ownership and delivery plan)
5. `HANDOFF.md` (project context and historical decisions)
6. `README.md` (purpose and quickstart)
7. `docs/PRINCIPLES.md` (synthesis: mission, locked decisions, autonomy rules)

## Hard Invariants (Treat As Laws)

1. Frontend reads only `/v1/*.json` from Blob. Never let it read pipeline internals (`data/clean/`, `data/interim/validated/`).
2. `iso3` is the canonical join key across all three contract files. Numeric `id` is retained only for TopoJSON map keys.
3. Missing observations are JSON `null`. Never `0`, `NaN`, empty string, or omitted key.
4. Frontend-facing scores are `higher_is_better` and live in `[0, 100]`. Inversion happens at exactly one place: the publish boundary in `src/upload/publish_dashboard.py`.
5. Validation gates upload — if `validate_payload` raises, the upload aborts and the previous `/v1/` snapshot stays live. Never partially publish.
6. Contract-breaking changes require a path/version bump (`/v1` → `/v2`) and updating `docs/data-contract.md` *first*, then publisher, then frontend.
7. Secrets never enter git; `.env` remains local.

## Caution Areas

- UN SDG fetch is slow and rate-limited. Run with `runtime.fetch_raw: false` unless you specifically need fresh data.
- Some UN SDG indicators (e.g. 3.d.1 IHR capacity) require per-dimension fetch; configured in `src/config/unsdg_indicator_classes.yaml` (`fetch_by_dimension: true`).
- Null-heavy countries are expected for some indicators; do not coerce to zero to make a chart render.
- Keep indicator key mappings synchronized with `indicators/indicators.yaml`. New indicators should arrive with fetch + clean + scorer wiring (or an explicit "blocked, owner X, ETA Y" entry in `SCORING_AUDIT.md`).
- Don't reintroduce the legacy 3-level (domain/sector/subsector) hierarchy as the primary contract shape. Compatibility CSVs may exist transitionally; the contract is 7 pillars × 17 subdomains × 28 indicators.

## Current Known Gaps

From `indicators/SCORING_AUDIT.md`:

- `gii`, `mpi`: missing UNDP HDR ingestion path.
- `ndgain`: component data exists; composite score path incomplete.
- `state`, `conces`: no complete data/scorer wiring.
- `popdens`: scorer formula mismatch vs taxonomy notes.
- `publish_dashboard.py`: builders are wired (meta/countries/timeseries) but the validation gate and atomic blob swap into `dashboard-public/v1/` aren't production-trusted yet. Owner: Christina.

## Team Execution Model

- Adeline: frontend UX/design parity
- Christina: frontend integration + backend/API publish integration
- Tyler: cleaning reliability + backend pipeline co-owner
- Caroline: source coverage closure
- Kayden: projections research only (no backend infra ownership)
- Co-PM: Azure platform, CORS, automation, operations

Detailed deliverables and milestones live in `TEAM-TASKS.md`.
