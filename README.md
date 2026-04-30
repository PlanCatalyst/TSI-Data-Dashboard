# PlanCatalyst Data Dashboard

## Project Purpose

This repository builds a contract-driven data pipeline and frontend data layer for
the PlanCatalyst dashboard. The end product is a React frontend embedded in Wix
that reads versioned JSON from Azure Blob:

- `meta.json`
- `countries.json`
- `timeseries.json`

The JSON contract is authoritative in `docs/data-contract.md`.

## Product Scope

- Audience: PlanCatalyst staff and clients.
- Core question answered: where development vulnerability is highest by country,
pillar, and indicator.
- Data cadence: biannual (not real-time).
- MVP: historical series only (projections remain disabled in contract metadata).

## Architecture Summary

```
fetch -> clean -> score/aggregate/project -> publish -> Azure Blob (/v1) -> React frontend -> Wix iframe
```

Data sources currently in use:

- UN SDG API
- World Bank API
- ND-GAIN ZIP export

Known source gaps are tracked in `indicators/SCORING_AUDIT.md` and
`TEAM-TASKS.md`.

## Contract-First Invariants

1. Frontend consumes only published JSON, never pipeline internals.
2. `iso3` is the canonical join key across payloads.
3. Missing values are `null` (never omitted or replaced with sentinel values).
4. Frontend-facing scores are `higher_is_better`.
5. Breaking contract changes require version bump (`/v1` -> `/v2`).

## Quickstart

1. Create environment and install dependencies.
2. Install pre-commit hooks (blocks accidental secret commits):

```zsh
pip install pre-commit
pre-commit install
```

3. Create `.env` from `.env.example` (never commit `.env`). Provision the
   Azure service principal in the **PlanCatalyst-owned tenant**, never in a
   contributor's personal Azure subscription.
4. Configure `src/config/settings.yaml` for your environment.
5. Run the full pipeline:

```zsh
python3 -m src.pipeline.run_pipeline
```

## Smoke Run Checklist

After a run, confirm:

1. Cleaned data exists under `data/clean/`.
2. Scored outputs exist under `data/interim/validated/`.
3. Publish step emits contract-valid JSON at target `/v1/` location.
4. Validation passes against `docs/data-contract.md` rules.
5. Frontend can fetch the three files from Blob without local overrides.

## Team and Ownership

Execution plan and owner-specific deliverables are in `TEAM-TASKS.md`.

Primary owners:

- PM: Thomas Llamzon
- Co-PM (Azure/platform): Anthony Lam
- Frontend design: Adeline
- Frontend + backend/API integration: Christina
- Data cleaning + backend pipeline co-owner: Tyler
- Source coverage: Caroline
- Projections research (data science): Kayden

## Key Project Documents

- `docs/data-contract.md` - authoritative JSON contract
- `docs/PRINCIPLES.md` - mission, locked decisions, AI autonomy rules
- `HANDOFF.md` - project context and migration decisions
- `TEAM-TASKS.md` - May execution plan by owner
- `indicators/indicators.yaml` - indicator taxonomy and metadata
- `indicators/SCORING_AUDIT.md` - scoring direction and implementation gaps

## AI Agent Skills

Project-scoped skills for Claude Code / Cursor agents live in
`.claude/skills/` (mirrored at `.cursor/skills/`). Agents should start with
the `plancatalyst-orientation` skill. See `.claude/skills/README.md`.

