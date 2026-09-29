# Tasks

> Replaces `TEAM-TASKS.md`, `DELIVERY-CHECKLIST.md`, and `DELEGATION-PROMPTS.md`
> (deleted 2026-09-08). Remaining work belongs to **Thomas**.
> Contract truth: `docs/data-contract.md`. Invariants: `CLAUDE.md`.

Status (2026-09-29): **live Blob republished** as `refresh-20260929` with the
2026-07-07 scoring fixes, `mspi` and `indicatorStatus`, and the **frontend
redeployed** the same evening. All client-side questions are answered; Reyna offered a wrap-up call
this week or next. Earlier: forecasting MVP merged 2026-09-15.

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
`src/calculating/mspi.py` implements it as of 2026-09-29, including her
accepted scope refinement (no IDS history means out of scope) and
`index_version` 1.1. See `docs/spec-macrosec-index.md`.

**Azure, 2026-09-29:** `tsidashboardblobstorage` confirmed in PlanCatalyst's
subscription (resource group `tsi-data-dashboard`). Service principal
`tsidashboard-pipeline` issued at container scope; secret expires 2027-09-28.

## Owner

| Person | Role |
|--------|------|
| **Thomas Llamzon** | PM and remaining delivery (pipeline, Azure, frontend, Wix E2E) |

## Remaining

- Macrosec composite from the 2026-09-17 spec (`docs/spec-macrosec-index.md`):
  **scored 2026-09-19** (`MSPI_INDEX`, 117 countries vs HDI 193 in 2010–2024),
  **coverage confirmed 2026-09-24**. Still to do: About-page / tooltip /
  vintage copy naming the excluded set.
- Rework `src/calculating/mspi.py` for the updated spec. **Status side done
  2026-09-27:** `mspi_country_status()` derives `scored` / `out_of_scope` /
  `incomplete_data` plus `missing_components` per country from the shared
  component panel and the `ids_in_scope` flag, and the calc stage writes
  `data/interim/validated/indicator_status.csv`. Against the on-disk data:
  117 scored, 28 incomplete, 128 out of scope, matching the spec diff. The
  composer still drops incomplete rows from the scored output, which is
  correct under `partial_scores: false`. **Scope refinement applied
  2026-09-29** after Reyna accepted it: in scope by lending type but no IDS
  observation in any year is `out_of_scope`. Published set: 117 scored,
  5 incomplete (BGR, ERI, GNQ, RUS, TKM), rest out of scope. Done.
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
  **Publisher and frontend done 2026-09-27.** `build_countries` attaches
  `indicatorStatus` from the sidecar (absent countries fill as
  `out_of_scope`), `validate_payload` enforces rule 6 against the timeseries,
  and the map detail panel's indicator chart shows the reason for a null
  instead of the generic no-data line. Bundled fixtures under
  `dashboard/public/v1/` regenerated from the dry run, so the local frontend
  now carries `mspi` in place of `hdi`. Additive, so no `/v2`.
- ~~Ask Reyna three follow-ups on the revised spec.~~ **All answered 2026-09-29:** scope
  refinement accepted (no IDS history means out of scope), series not snapshot, version
  bumped to 1.1. Applied in `src/calculating/mspi.py` the same day.
- ~~Re-run the UN SDG cleaner for M49 country codes.~~ **Closed 2026-09-24.**
  The on-disk file already carries ISO3 throughout (234 distinct codes, none
  numeric). No re-run needed.
- ~~Confirm which subscription owns `tsidashboardblobstorage`.~~ **Confirmed
  2026-09-29:** PlanCatalyst's. No migration, no frontend URL change.
- Pre-handoff hardening: CORS allow-list on `dashboard-public` limited to
  the Wix/plancatalyst origins plus local dev; verify `Cache-Control` on the
  live payloads; scan git history for secrets.
- ~~Republish `dashboard-public/v1/`.~~ **Done 2026-09-29**, run id `refresh-20260929`,
  meta last, verified live: `mspi` in `pri`, 216 countries with `indicatorStatus`
  (117 scored / 5 incomplete / 94 out of scope on the published set).
  `Cache-Control: public, max-age=3600` confirmed on the payloads.
- ~~Dispatch the **Deploy dashboard** workflow.~~ **Done 2026-09-29.** First run failed on a
  missing `AZURE_STATIC_WEB_APPS_API_TOKEN`; secret set from `az staticwebapp secrets list`,
  rerun green. Hosted bundle verified to carry the status rendering and the production Blob
  URL. Recovery steps added to `docs/runbook-refresh.md`.
- ~~Deploy the forecast-enabled frontend build~~ (deployed 2026-09-29), then publish
  forecasts with `runtime.run_forecasts: true` when ready.
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
- ~~Service principal.~~ **Issued 2026-09-29:** `tsidashboard-pipeline`, Storage Blob Data
  Contributor on the `dashboard-public` container only, on `tsidashboardblobstorage` in
  PlanCatalyst's subscription (resource group `tsi-data-dashboard`). Secret expires
  2027-09-28. A second principal `tsi-analytics` holds the same role; confirm on the call.
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
