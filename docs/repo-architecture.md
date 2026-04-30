# Repository Architecture (Target State)

## Purpose

Define the repository layout that best fits the final product:

- contract-first data publishing to Azure Blob
- React frontend consuming only contract JSON
- modular backend stages that can grow without path churn

## Current Rule

Keep executable backend code under `src/`. Keep root-level files for docs, policy, and project metadata only.

## Target Layout

```text
TSI-Data-Dashboard/
  README.md
  CLAUDE.md
  HANDOFF.md
  TEAM-TASKS.md
  docs/
    data-contract.md
    repo-architecture.md
  indicators/
    indicators.yaml
    country_codes.csv
    SCORING_AUDIT.md
  scripts/
    build_country_codes.py
  src/
    config/
      settings.yaml
      unsdg_indicator_classes.yaml
    fetch/
      ...
    clean/
      ...
    calculating/
      ...
    upload/
      publish_dashboard.py
      upload_validated.py
    pipeline/
      orchestrator.py
      run_pipeline.py
      ...
  data/
    raw/
    interim/
      cleaned/
      validated/
      published/
```

## Why this structure scales

1. **Stage boundaries are explicit** (`fetch`, `clean`, `calculating`, `upload`, `pipeline`).
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
   - frontend contract: only `/vN/meta.json`, `/vN/countries.json`, `/vN/timeseries.json`
3. Legacy compatibility outputs stay optional and removable via config.
