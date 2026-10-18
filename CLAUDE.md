# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mission

Maintain PlanCatalyst's **Global Country Development Scoring Engine**: a scoring pipeline and the web frontend that presents it. Call the product by that name, never "the dashboard" (`dashboard/` is only the frontend's directory). The work:

1. Fetch and normalize source data (UN SDG, World Bank API, ND-GAIN, UNDP HDR, World Bank WGI).
2. Score and aggregate by the 7-pillar taxonomy.
3. Publish versioned JSON payloads (`meta.json`, `countries.json`, `timeseries.json`) to Azure Blob.
4. Serve those payloads to a React frontend embedded in Wix.

The engine is a decision-support product for identifying country-level need. It is **not** an impact attribution system.

## Repository Layout
Moved verbatim to `docs/CLAUDE-reference.md` (same heading). Read it before working in this area.

## Common Commands

### Python pipeline (from repo root)

```zsh
# One-time setupad
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

```zsh
.venv/bin/python -m pytest -q
cd dashboard && npm ci && npm audit --audit-level=moderate && npm run build
docker build --tag tsi-pipeline:ci .
```

GitHub Actions runs the backend tests and dependency audit, frontend dependency
audit and production build, pipeline container build, and CodeQL. There is
still no standalone Python/TypeScript linter.

## Pipeline Architecture
Moved verbatim to `docs/CLAUDE-reference.md` (same heading). Read it before working in this area.

### The publish boundary is the only place orientation flips
Moved verbatim to `docs/CLAUDE-reference.md` (same heading). Read it before working in this area.

### Indicator taxonomy bridges two naming worlds
Moved verbatim to `docs/CLAUDE-reference.md` (same heading). Read it before working in this area.

## Key Dev-Loop Knobs (`src/config/settings.yaml`)
Moved verbatim to `docs/CLAUDE-reference.md` (same heading). Read it before working in this area.

## Source of Truth Hierarchy

When documents disagree, resolve in this order (lower number wins):

1. `docs/data-contract.md` (payload schema and semantics)
2. `indicators/indicators.yaml` (indicator taxonomy and metadata)
3. `indicators/SCORING_AUDIT.md` (scoring direction and known gaps)
4. `TASKS.md` (remaining work and ownership)
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
Moved verbatim to `docs/CLAUDE-reference.md` (same heading). Read it before working in this area.

## Current Known Gaps
Moved verbatim to `docs/CLAUDE-reference.md` (same heading). Read it before working in this area.

## Ownership

Maintainer: Thomas Llamzon (pipeline, Azure, frontend, Wix embed).

Remaining work lives in `TASKS.md`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues at `PlanCatalyst/TSI-Data-Dashboard`, created manually. No team-wide conventions for labels or workflow yet.

### Triage labels

Default canonical vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Only `wontfix` exists in the repo today; the others will be created by the `triage` skill on first use.

### Domain docs

Single-context. `CONTEXT.md` and `docs/adr/` live at the repo root; both `src/` (Python pipeline) and `dashboard/` (React frontend) share the same domain vocabulary (pillars, indicators, contract).
