# PlanCatalyst Project Principles (For Humans And Agents)

This file consolidates the project's non-negotiable goals, invariants, and
operating standards into one place that AI coding agents can use to make
autonomous decisions without re-litigating settled questions.

It is a companion to:

- `CLAUDE.md` (machine-readable orientation)
- `README.md` (purpose and quickstart)
- `HANDOFF.md` (historical context)
- `TEAM-TASKS.md` (May execution plan and ownership)
- `docs/data-contract.md` (authoritative payload schema)
- `indicators/SCORING_AUDIT.md` (scoring directionality)

When a document disagrees with this one, follow the **Source of Truth Hierarchy**
in `CLAUDE.md`. This file does not invent new authority; it makes the
existing authority easier for an agent to act on.

---

## 1. Mission (One Sentence)

Publish contract-valid JSON (`meta.json`, `countries.json`, `timeseries.json`)
from an automated pipeline so a React frontend embedded in Wix can render
country-level development vulnerability without ever touching pipeline internals.

## 2. Locked Decisions (Do Not Re-Debate)

These are pre-approved by the PM and listed in `TEAM-TASKS.md`. An agent
encountering one of these should proceed, not pause to ask:



1. **Contract path**: `/v1/` now; breaking changes require `/v2/` and keeping
  both live during cutover.
2. **Frontend blueprint**: `PlanCatalyst TSI Data Dashboard Final.html` is
  client-approved. Match its UX intent unless a strict implementation
   constraint forces deviation.
3. **Coverage target**: all 28 indicators live by May 31. Permanent placeholder
  status is unacceptable; explicit-with-ETA placeholder is acceptable.
4. **Projection Transparency**: All projections should exist within a reasonable margin of error; projections that are intentionally blank should be handled with user feedback explaining *why* there
5. **Publish phasing**: Phase A is local `dry_run` to `data/organized/v1/`.
  Phase B is Azure upload. Do not skip Phase A.
6. **Repo hygiene**: upload code lives in `src/upload/`, active settings live
  in `src/config/settings.yaml`. Do not create root-level duplicates.
7. **Decision routing while PM is away**: Co-PM is default unblock owner.
  Contract-semantic decisions are co-decided by Christina + Tyler and
   recorded in `docs/`.

## 3. Hard Invariants (Treat As Laws)

These cannot change without a contract version bump and PM sign-off:

1. **Frontend reads only `/v1/*.json` from Blob.** Never let it read pipeline
  internals (`data/clean/`, `data/interim/validated/`).
2. `**iso3` is the canonical join key** across all three contract files.
3. **Missing data is JSON `null`.** Never `0`, `NaN`, empty string, or omitted
  key.
4. **Frontend-facing scores are `higher_is_better` and live in `[0, 100]`.**
  The pipeline emits vulnerability-oriented scores; inversion (`100 - x`)
   happens at exactly one place: the publish boundary in
   `src/upload/publish_dashboard.py`. Do not invert anywhere else. Do not
   rewrite scorers in `src/calculating/` to flip orientation.
5. **Validation gates upload.** If `validate_payload` raises, the upload
  aborts and the previous `/v1/` snapshot stays live.
6. **Secrets never enter git.** `.env` is local. Service principal credentials
  come from environment variables.

## 4. Source Of Truth Hierarchy (Resolve Conflicts In This Order)

1. `docs/data-contract.md` (payload schema and semantics)
2. `indicators/indicators.yaml` (indicator taxonomy and metadata)
3. `indicators/SCORING_AUDIT.md` (scoring direction and known gaps)
4. `TEAM-TASKS.md` (current ownership and delivery plan)
5. `HANDOFF.md` (project context and historical decisions)
6. `README.md` (purpose, quickstart)
7. This file (`docs/PRINCIPLES.md`) — synthesis only, not new authority.

If two of the above disagree, the higher-numbered one defers.

## 5. Work Priority Order

When multiple things are broken or missing, fix in this order:

1. Contract correctness and publish validation.
2. Source coverage closure for missing indicators.
3. Frontend parity and robust error/null handling.
4. Automation, alerts, and operational reliability.
5. Projections readiness assessment (post-MVP).

## 6. Agent Autonomy Rules

### Proceed without asking when

- A locked decision in §2 already covers the question.
- A hard invariant in §3 dictates the answer.
- The Source of Truth Hierarchy resolves a conflict.
- The change is additive (new fetch source, new test, new doc) and does not
alter contract shape, score direction, or repo structure.
- The work is purely internal to a stage (`fetch/`, `clean/`, `calculating/`)
and does not change what crosses the publish boundary.

### Stop and ask when

- The change would alter `docs/data-contract.md` shape or semantics.
- The change would invert score direction outside the publish boundary.
- The change would introduce a non-Azure / non-React stack assumption.
- The change would commit secrets or modify `.gitignore` to allow them.
- A document conflict is unresolved by the Source of Truth Hierarchy.
- A task explicitly requires a PM sign-off in `TEAM-TASKS.md`.

### Never do

- Coerce missing data to `0` to make a chart render.
- Read pipeline CSVs directly from frontend code.
- Reintroduce the legacy 3-level (domain/sector/subsector) hierarchy as the
primary contract shape. Compatibility CSVs may exist transitionally; the
contract is 7 pillars × 17 subdomains × 28 indicators.
- Hardcode country lists. Use `indicators/country_codes.csv`.
- Re-fetch UN SDG data unnecessarily — it is slow and rate-limited.

## 7. Quality Standards

- **Contract changes**: must update `docs/data-contract.md` first, then the
publisher, then the frontend.
- **New indicators**: must arrive with fetch + clean + scorer wiring (or an
explicit "blocked, owner X, ETA Y" entry in `indicators/SCORING_AUDIT.md`).
- **Tests**: pure builder functions in `publish_dashboard.py` and frontend
contract loaders/selectors must have at least one happy-path and one
null-heavy test.
- **Logs**: pipeline stages emit counts (rows in, rows out, dropped).
- **Failure**: prefer aborting with a precise locator (which iso3, which
indicator, which year) over silently emitting a degraded payload.

## 8. Definition Of Project Success

- Contract-valid JSON publishes from automated pipeline runs without manual
intervention.
- Hosted frontend reads Blob payloads with no local hacks or fallbacks.
- All 28 indicators are either live or explicitly exception-tracked with
owner + ETA.
- The team can operate without daily PM decision calls because runbooks and
this principles file cover the recurring questions.

## 9. When This File Is Wrong

If you (human or agent) find this file inconsistent with a higher-priority
source, fix this file in the same PR that surfaces the conflict. Do not let
this file drift into authority it does not have.