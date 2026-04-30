# PlanCatalyst Project Operating Context

This document is written as a machine-readable orientation file for contributors
and coding agents in the new repository.

## Mission

Deliver a reliable backend-to-frontend contract for the PlanCatalyst dashboard:

1. Fetch and normalize source data.
2. Score and aggregate by the 7-pillar taxonomy.
3. Publish versioned JSON payloads to Azure Blob.
4. Serve those payloads to a React frontend embedded in Wix.

## Source of Truth Hierarchy

When documents disagree, resolve in this order (lower number wins):

1. `docs/data-contract.md` (payload schema and semantics)
2. `indicators/indicators.yaml` (indicator taxonomy and metadata)
3. `indicators/SCORING_AUDIT.md` (scoring direction and known gaps)
4. `TEAM-TASKS.md` (current ownership and delivery plan)
5. `HANDOFF.md` (project context and historical decisions)
6. `README.md` (purpose and quickstart)
7. `docs/PRINCIPLES.md` (synthesis: mission, locked decisions, autonomy rules)
8. `.claude/skills/*/SKILL.md` (agent skills — synthesis layer, never new authority)

## Agent Skills

Project-scoped skills for AI coding agents live in `.claude/skills/` (mirrored
to `.cursor/skills/` via symlinks). Start with `plancatalyst-orientation`.
See `.claude/skills/README.md` for the full index.

## Current Product State

- Frontend contract target: `/v1/meta.json`, `/v1/countries.json`, `/v1/timeseries.json`
- Frontend scoring semantics: `higher_is_better`
- Country key: `iso3` canonical; numeric id retained for map compatibility
- Projections: research in progress, not enabled for MVP payload
- Known implementation gaps: see `indicators/SCORING_AUDIT.md` section on gaps

## Critical Invariants

1. Frontend consumes only published JSON, not internal CSV artifacts.
2. Contract changes are versioned; breaking changes require major bump and new path.
3. Missing observations are `null`.
4. Publish step enforces scoring direction expected by frontend.
5. Secrets never enter git; `.env` remains local.

## Team Execution Model

- Adeline: frontend UX/design parity
- Christina: frontend integration + backend/API publish integration
- Tyler: cleaning reliability + backend pipeline co-owner
- Caroline: source coverage closure
- Kayden: projections research only (no backend infra ownership)
- Co-PM: Azure platform, CORS, automation, operations

Detailed deliverables and milestones live in `TEAM-TASKS.md`.

## Work Priorities (Order)

1. Contract correctness and publish validation.
2. Source coverage closure for missing indicators.
3. Frontend parity and robust error/null handling.
4. Automation, alerts, and operational reliability.
5. Projections readiness assessment for post-MVP release.

## Caution Areas

- UN SDG fetch is slow and rate-limited; avoid unnecessary re-fetches.
- Null-heavy countries are expected for some indicators; do not coerce to zero.
- Keep indicator key mappings synchronized with `indicators/indicators.yaml`.
- Validate payload counts and key completeness before upload.

## Definition of Project Success

- Contract-valid JSON is published from automated pipeline runs.
- Hosted frontend reads Blob payloads without local hacks.
- Coverage gaps are either closed or explicitly exception-tracked with owner + ETA.
- Team can operate without Thomas in daily decision loops using docs/runbooks.
