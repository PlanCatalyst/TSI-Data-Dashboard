# Repository Architecture

## Purpose

Describe the repository layout that fits the product:

- contract-first data publishing to Azure Blob
- React frontend consuming only contract JSON
- modular backend stages that can grow without path churn

## Current Rule

Keep executable backend code under `src/`. Keep root-level files for docs, policy, and project metadata only.

## Layout (current as of 2026-10-17)

```text
TSI-Data-Dashboard/
  README.md  CLAUDE.md  HANDOFF.md  TASKS.md  RUNNING.md
  Dockerfile                      # pipeline image (tsi-pipeline)
  .github/workflows/
    ci.yml                        # backend tests + pip-audit, frontend build + npm audit, docker build
    codeql.yml
    deploy-dashboard.yml          # workflow_dispatch only, main only, production environment
  docs/                           # data-contract.md, runbook-refresh.md, playbook/, ...
  indicators/
    indicators.yaml
    country_codes.csv
    SCORING_AUDIT.md
  infra/
    container-apps-job.sh         # manual-trigger Container Apps Job (coded, not provisioned)
  scripts/                        # ad-hoc utilities (acr_build.sh, archive_raw.py, ...)
  audit/                          # data audit scripts and findings
  projections/                    # production forecasting inputs/code used by src/projections
  dashboard/                      # React + Vite + D3 frontend (Azure Static Web Apps)
    src/app/routes/               # Explore, Compare, Map, About (+ TrendsPanel)
    public/                       # local contract fixtures and staticwebapp.config.json
  src/
    config/
      settings.yaml
      unsdg_indicator_classes.yaml
    fetch/                        # UN SDG, World Bank, ND-GAIN, UNDP HDR, WGI
    archive/                      # raw store (store.py)
    clean/
    calculating/                  # scorers, dimensions.py, mspi.py, pillar_aggregate.py
    validation/                   # blocking data-validation gate
    forecasting/                  # optional, off by default
    projections/                  # optional, off by default
    upload/
      upload_validated.py
      publish_dashboard.py
    pipeline/
      orchestrator.py
      run_pipeline.py
    utils/
  data/                           # local-only artifacts
    raw/
    store/<run_id>/               # immutable raw store, LATEST pointer
    clean/
    interim/validated/
    organized/v1/                 # dry-run publish output
    processed/
```

## Why this structure scales

1. **Stage boundaries are explicit.** Run order (`src/pipeline/orchestrator.py`): fetch, raw store (`archive`), clean, score (`calculating`), data validation (blocking gate), upload validated, forecasts (off by default), publish (`upload/publish_dashboard.py`).
2. **Contract and taxonomy are centralized** in `docs/` and `indicators/`.
3. **Operational config is isolated** in `src/config/`.
4. **Future growth is additive**:
   - add new sources under `src/fetch/` + `src/clean/`
   - add scoring logic under `src/calculating/`
   - keep publish contract logic in `src/upload/`

## Guardrails

1. Do not add duplicate executable modules at repo root (for example `upload/`, `config/`).
2. Do not add frontend contract logic outside `src/upload/publish_dashboard.py`.
3. Any contract change must first update `docs/data-contract.md`.
4. Preserve the canonical country key contract: `iso3` across all payloads.
5. Missing observations remain `null`; never convert to sentinel values.

## Open-to-growth conventions

1. New source onboarding always ships with:
   - fetch module
   - clean mapping
   - scorer wiring (or explicit reason why not scored yet)
   - coverage status update in team docs
2. New artifact outputs are versioned by purpose:
   - internal: under `data/interim/...`
   - frontend contract: only `/vN/meta.json`, `/vN/countries.json`, `/vN/timeseries.json`, plus `/vN/projections.json` on a forecast run (projections are off by default)
3. Legacy compatibility outputs stay optional and removable via config.
