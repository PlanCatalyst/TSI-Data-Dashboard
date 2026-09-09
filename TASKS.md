# Tasks

> Replaces `TEAM-TASKS.md`, `DELIVERY-CHECKLIST.md`, and `DELEGATION-PROMPTS.md`
> (deleted 2026-09-08). All remaining work belongs to Thomas or Anthony.
> Contract truth: `docs/data-contract.md`. Invariants: `CLAUDE.md`.

Status: client thread answered 2026-09-04; ball is with PlanCatalyst for the
service principal, the `conces` spec document, and the `popdens` direction
confirmation.

## Owners

| Person | Role |
|--------|------|
| **Thomas Llamzon** | PM, full-stack, frontend presentability, Wix E2E |
| **Anthony Lam** | Co-PM, Azure, indicators, cleaning, publish |

## Thomas

- Republish `dashboard-public/v1/` once credentials exist (procedure:
  `docs/runbook-refresh.md`). Live Blob still serves the pre-fix
  `fresh-20260701` snapshot.
- Mock parity pass and responsive QA at Wix iframe widths.
- Wix embed E2E on `plancatalyst.org` once Reyna places the iframe.
- Route client sign-off (Reyna is final authority).

## Anthony

- `conces` composite once the client spec document arrives: ingestion,
  formula, scorer, `indicators.yaml` entry, `SCORING_AUDIT.md` row, re-run.
- Re-run the UN SDG cleaner: on-disk `un_sdg_clean.csv` still uses M49
  numeric codes, not ISO3.
- Confirm which subscription owns `tsidashboardblobstorage`. If it is a
  personal one, plan migration before handoff (requires a frontend rebuild
  and SWA redeploy, since the Blob URL is baked in at build time).
- Pre-handoff hardening: CORS allow-list on `dashboard-public` limited to
  the Wix/plancatalyst origins plus local dev; verify `Cache-Control` on the
  live payloads; scan git history for secrets.

## Blocked on PlanCatalyst (asked 2026-09-04)

- `conces` composite spec document (attachment never arrived; re-requested).
- Service principal: Storage Blob Data Contributor scoped to the
  `dashboard-public` container only.
- `popdens` display-direction confirmation (publish boundary inverts).
- Call scheduling.

## Acceptance (MVP)

1. Live Blob serves a post-fix snapshot and the hosted frontend reads it.
2. Wix iframe live on `plancatalyst.org`; all four routes work at iframe
   widths, mobile and desktop.
3. 28/28 indicators live, or a client-approved exception recorded in
   `indicators/SCORING_AUDIT.md`.
4. Handoff docs complete: `docs/runbook-refresh.md`, `RUNNING.md`,
   `HANDOFF.md`.
5. PlanCatalyst sign-off recorded.

## Descoped / deferred

- Containerized and scheduled pipeline (descoped 2026-09-04): the confirmed
  6-month cadence does not justify ACR, an image build, or a container host.
  Manual runbook instead; `docs/docker.md` retained if the cadence shortens.
- Projections UI still disabled (`meta.projections.enabled === false`) until forecasting MVP PRs A–C land; see below.
- CI and test suites: none exist; add only if cadence or team size grows.
- Legacy 3-level compatibility CSVs: remove once confirmed unused.


## Forecasting MVP (split PRs)

| PR | Scope | Owner |
|----|-------|-------|
| **A** (`feat/forecast-contract-gates`) | Quality gates + `validate_payload` for interval forecast rows + contract §8 docs + pytest | Thomas |
| **B** (`feat/forecast-engine`) | Forecast model only — no publish wiring | Thomas |
| **C** | Orchestrator / publish atomicity for projection rows | TBD |

Do **not** enable `meta.projections.enabled` until A+B+C land and frontend
consumes interval rows. UX copy for unavailable forecasts is fixed:

> Forecast unavailable due to insufficient information.
