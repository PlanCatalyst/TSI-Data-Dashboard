# Tasks

> Replaces `TEAM-TASKS.md`, `DELIVERY-CHECKLIST.md`, and `DELEGATION-PROMPTS.md`
> (deleted 2026-09-08). All remaining work belongs to Thomas or Anthony.
> Contract truth: `docs/data-contract.md`. Invariants: `CLAUDE.md`.

Status: forecasting MVP merged to local `main` and verified 2026-09-15. Live
publish is still blocked on Azure credentials. PlanCatalyst still owes the
`conces` spec document and `popdens` direction confirmation.

## Owners

| Person | Role |
|--------|------|
| **Thomas Llamzon** | PM, full-stack, frontend presentability, Wix E2E |
| **Anthony Lam** | Co-PM, Azure, indicators, cleaning, publish |

## Thomas

- Republish `dashboard-public/v1/` once credentials exist (procedure:
  `docs/runbook-refresh.md`). Live Blob still serves the pre-fix
  `fresh-20260701` snapshot.
- Deploy the forecast-enabled frontend build, then publish forecasts with
  `runtime.run_forecasts: true`.
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

- Scheduled pipeline: deferred as a follow-up on 2026-09-15. The manual
  runbook remains the interim delivery, but the target is a twice-yearly Azure
  Container Apps Job with managed identity, source-version discovery, and
  failure alerts. Until that lands, forecast/projection publish is manual; see
  `docs/runbook-refresh.md` § Forecast publish.
- CI and test suites: none exist; add only if cadence or team size grows.
- Legacy 3-level compatibility CSVs: remove once confirmed unused.


## Forecasting MVP — merged 2026-09-15

- Quality gates, ARIMA intervals, atomic publish, projection UI, and Reyna's
  interim runbook are now on `main`.
- Verification: 43 backend tests pass; production TypeScript/Vite build passes.
- The UI now labels the last observed year and visually separates solid
  observed data from dashed forecasts and shaded 95% intervals.
- Enabling live projections remains an ops step: set
  `runtime.run_forecasts: true`, run ProcessData, publish, and deploy the
  forecast-enabled frontend. Publish flips `meta.projections.enabled` when the
  forecasts CSV is present.
- Forecast coverage is currently limited to eligible World Bank series.

UX copy for unavailable forecasts remains fixed:

> Forecast unavailable due to insufficient information.
