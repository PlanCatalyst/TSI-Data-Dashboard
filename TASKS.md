# Tasks

> Replaces `TEAM-TASKS.md`, `DELIVERY-CHECKLIST.md`, and `DELEGATION-PROMPTS.md`
> (deleted 2026-09-08). Remaining work belongs to **Thomas**.
> Contract truth: `docs/data-contract.md`. Invariants: `CLAUDE.md`.

Status: forecasting MVP merged to local `main` and verified 2026-09-15. Live
publish is still blocked on Azure credentials. Reyna replied 2026-09-17: the
macrosec spec is in hand (`docs/spec-macrosec-index.md`), `popdens` display
direction is confirmed (keep scored + inverted), and the wrap-up call waits
until IT finishes the service-principal request.

**Ownership (2026-09-19):** Thomas is finishing the project. Anthony is no
longer an active owner. Historical commits and closed items still name him
where he did the work.

Contract key `mspi` landed 2026-09-19 (`docs/data-contract.md`, publisher,
`indicators.yaml`). Composer wired and scored the same day (`MSPI_INDEX`:
117 countries vs HDI 193 in 2010–2024). **Coverage confirmed by Reyna
2026-09-24:** exclude non-covered countries, do not substitute. `mspi` is
cleared to replace `hdi` in the live snapshot. Her **revised spec arrived the
same day** (`Macro_Socio-Economic_Performance_Index_Spec UPDATED.docx`, repo
root): formula unchanged, but it adds an IDS scope rule resolved from
`lendingType.id`, a three-value `status` field, and `partial_scores: false`.
`src/calculating/mspi.py` implements the superseded model and needs rework.
See `docs/spec-macrosec-index.md`.

**Azure, 2026-09-24:** PlanCatalyst IT reported no `dashboard-public` container
and screenshotted storage account `tsidatadashboard98a4`. That is not the
account the dashboard reads (`tsidashboardblobstorage`). Reply for IT is
drafted in `docs/azure-it-request.md`.

## Owner

| Person | Role |
|--------|------|
| **Thomas Llamzon** | PM and remaining delivery (pipeline, Azure, frontend, Wix E2E) |

## Remaining

- Macrosec composite from the 2026-09-17 spec (`docs/spec-macrosec-index.md`):
  **scored 2026-09-19** (`MSPI_INDEX`, 117 countries vs HDI 193 in 2010–2024),
  **coverage confirmed 2026-09-24**. Still to do: About-page / tooltip /
  vintage copy naming the excluded set.
- Rework `src/calculating/mspi.py` for the updated spec: scope input from
  World Bank `lendingType.id`, a `status` column
  (`scored` / `out_of_scope` / `incomplete_data`), a `missing_components`
  column, and stop dropping incomplete rows. Blocked on the two scope questions
  to Reyna below, which change what the composer emits.
- ~~Add a World Bank country-metadata fetch for `lendingType.id`.~~
  **Done 2026-09-24.** `WorldBankFetcher.fetch_country_metadata()` (one call,
  `per_page=400`) plus `WorldBankCleaner.clean_country_metadata()` emit
  `data/clean/world-bank/wb_country_metadata.csv` (217 countries, aggregates
  dropped, 145 in IDS scope). Wired into fetch and clean stages and registered
  in `settings.yaml`. 7 tests in `tests/clean/test_wb_country_metadata.py`.
- Add an additive `status` field to the contract. **Contract done 2026-09-24**
  (`docs/data-contract.md` §3.1 `indicatorStatus`, plus validation rule 6 and a
  cross-reference from the §1 nulls convention). Country-level rather than
  country-year, because World Bank lending classification has no history.
  Remaining: publisher emits it, then frontend consumes it (invariant 6).
  Additive, so no `/v2`.
- Ask Reyna three follow-ups on the revised spec: her scope rule returns 145
  countries against her stated ~120 and mislabels 15 high-income IBRD
  graduates as `incomplete_data`; `mrnev=1` would make `mspi` a snapshot and
  flatten the `pri` trend line; `index_version` needs bumping since output
  semantics changed. Detail in `docs/spec-macrosec-index.md`.
- ~~Re-run the UN SDG cleaner for M49 country codes.~~ **Closed 2026-09-24.**
  The on-disk file already carries ISO3 throughout (234 distinct codes, none
  numeric). No re-run needed.
- Confirm which subscription owns `tsidashboardblobstorage`. IT's 2026-09-24
  screenshot shows they were looking at `tsidatadashboard98a4`, a different
  account holding only Functions runtime containers, so the two accounts are
  confirmed distinct. If `tsidashboardblobstorage` is a personal one, plan
  migration before handoff (requires a frontend rebuild and SWA redeploy,
  since the Blob URL is baked in at build time). Reply drafted in
  `docs/azure-it-request.md`.
- Pre-handoff hardening: CORS allow-list on `dashboard-public` limited to
  the Wix/plancatalyst origins plus local dev; verify `Cache-Control` on the
  live payloads; scan git history for secrets.
- Republish `dashboard-public/v1/` once credentials exist (procedure:
  `docs/runbook-refresh.md`). Live Blob still serves the pre-fix
  `fresh-20260701` snapshot.
- Deploy the forecast-enabled frontend build, then publish forecasts with
  `runtime.run_forecasts: true`.
- Mock parity pass and responsive QA at Wix iframe widths.
- Wix embed E2E on `plancatalyst.org` once Reyna places the iframe.
- Route client sign-off (Reyna is final authority).

- ~~Confirm rank and comparison views treat a null `pri` as excluded rather
  than last place.~~ **Audited 2026-09-24.** `cmpNumeric` in `ExplorePage`
  already parks nulls at the bottom in both sort directions without ranking
  them, and `ComparePage` renders `null` as an em-dash and excludes it from
  subdomain averages. One defect found and fixed: `TrendsPanel.tsx:227` coerced
  a null last-observation to `-1` before sorting, placing a no-data country
  below the worst real performer in the regional sparkline list. Frontend build
  passes.
- **Open decision: `displayOverall` computes a partial average.**
  `dashboard/src/data/contract/selectors.ts:133` falls back to averaging
  whichever pillars are non-null when `overall` is null, and the result renders
  in the same column as true 7-pillar averages. That is the same bias the
  client's own `partial_scores: false` rule rejects: the pillars that are
  missing are not missing at random. Deliberate (it keeps the map from going
  grey) but now inconsistent with the documented methodology. Needs a product
  call: either mark partial averages visually, or stop computing them.

## Blocked on PlanCatalyst (asked 2026-09-04; reply 2026-09-17)

- ~~`conces` composite spec document.~~ Received 2026-09-17. Contract key
  `mspi` landed 2026-09-19. ~~Coverage 117 vs HDI 193, confirm before live
  swap.~~ Confirmed 2026-09-24: exclude non-covered countries.
- ~~Revised index document.~~ Received and diffed 2026-09-24. Three follow-up
  questions now with Reyna (scope count, `mrnev=1`, version bump).
- Service principal: Storage Blob Data Contributor scoped to the
  `dashboard-public` container only. IT came back 2026-09-24 saying the
  container does not exist, having looked at the wrong storage account.
  Blocked on IT answering which subscription owns `tsidashboardblobstorage`.
  See `docs/azure-it-request.md`.
- ~~`popdens` display-direction confirmation.~~ Confirmed 2026-09-17: keep
  scored + inverted; dense countries display low. No code change.
- Call scheduling. She prefers to wait until IT finishes, then close remaining
  items in one meeting.

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
- CI, dependency audits, container build verification, and CodeQL are active.
  Production dashboard deployment remains manual and environment-gated.
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
