# Tasks

> Replaces `TEAM-TASKS.md`, `DELIVERY-CHECKLIST.md`, and `DELEGATION-PROMPTS.md`
> (deleted 2026-09-08).
> Contract truth: `docs/data-contract.md`. Invariants: `CLAUDE.md`.

Status (2026-09-29): **live Blob republished** as `refresh-20260929` with the
2026-07-07 scoring fixes, `mspi` and `indicatorStatus`, and the **frontend
redeployed** the same evening. All open scoring questions are closed. Earlier: forecasting MVP merged 2026-09-15.

**Ownership:** maintained by Thomas Llamzon.

Contract key `mspi` landed 2026-09-19 (`docs/data-contract.md`, publisher,
`indicators.yaml`). Composer wired and scored the same day (`MSPI_INDEX`:
117 countries vs HDI 193 in 2010–2024). **Coverage rule (2026-09-24):** exclude non-covered countries, do not substitute. `mspi` is
cleared to replace `hdi` in the live snapshot. The **spec was revised the
same day**: formula unchanged, but it adds an IDS scope rule resolved from
`lendingType.id`, a three-value `status` field, and `partial_scores: false`.
`src/calculating/mspi.py` implements it as of 2026-09-29, including the
scope refinement (no IDS history means out of scope) and
`index_version` 1.1. See `docs/spec-macrosec-index.md`.

**Azure, 2026-09-29:** the storage account (`AZURE_STORAGE_ACCOUNT_URL`) is in
PlanCatalyst's subscription. Pipeline service principal issued at container scope
(credentials in `.env`).

## Owner

| Person | Role |
|--------|------|
| **Thomas Llamzon** | Maintainer (pipeline, Azure, frontend, Wix E2E) |

## Remaining

- **Republish with the 7.2.1 `renew` and 3.7.1 `contra` rescore.** Scoring,
  tests, docs, About copy and local `/v1/` fixtures are done (2026-10-19,
  `RelativeGainScorer`; see `indicators/SCORING_AUDIT.md`). Left: review, merge,
  `python -m src.upload.publish_dashboard --azure`, redeploy the frontend so the
  About page ships with it. There is no global `index_version` field in
  `meta.json` to bump; the change is recorded in `docs/data-contract.md` §5.
- About wiki follow-ups (deferred from the 2026-10-15 frontend-only release,
  `docs/requirements-v2.md` §9): fix the `sanit`, `susag` and `u5mr` labels
  and units in `indicators/indicators.yaml` so they reach `meta.json`; write
  the REQ9.11 generator (yaml plus scorer constants to a generated
  methodology file) with a CI staleness check; then drop the label overrides
  in `dashboard/src/content/about/methodology.ts`.
- Macrosec composite from the 2026-09-17 spec (`docs/spec-macrosec-index.md`):
  **scored 2026-09-19** (`MSPI_INDEX`, 117 countries vs HDI 193 in 2010–2024),
  **coverage rule applied 2026-09-24**. Still to do: About-page / tooltip /
  vintage copy naming the excluded set.
- Rework `src/calculating/mspi.py` for the updated spec. **Status side done
  2026-09-27:** `mspi_country_status()` derives `scored` / `out_of_scope` /
  `incomplete_data` plus `missing_components` per country from the shared
  component panel and the `ids_in_scope` flag, and the calc stage writes
  `data/interim/validated/indicator_status.csv`. Against the on-disk data:
  117 scored, 28 incomplete, 128 out of scope, matching the spec diff. The
  composer still drops incomplete rows from the scored output, which is
  correct under `partial_scores: false`. **Scope refinement applied
  2026-09-29**: in scope by lending type but no IDS
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
- ~~Resolve three open points in the revised spec.~~ **Closed 2026-09-29:** no IDS
  history means out of scope, series not snapshot, version
  bumped to 1.1. Applied in `src/calculating/mspi.py` the same day.
- ~~Re-run the UN SDG cleaner for M49 country codes.~~ **Closed 2026-09-24.**
  The on-disk file already carries ISO3 throughout (234 distinct codes, none
  numeric). No re-run needed.
- ~~Confirm which subscription owns the storage account.~~ **Resolved
  2026-09-29:** PlanCatalyst's. No migration, no frontend URL change.
- Pre-handoff hardening: CORS allow-list on the public payload container limited to
  the Wix/plancatalyst origins plus local dev; verify `Cache-Control` on the
  live payloads; scan git history for secrets.
- ~~Republish the public payload container.~~ **Done 2026-09-29**, run id `refresh-20260929`,
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
- Wix embed E2E on `plancatalyst.org` once the iframe is placed.
- Release review.

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
  documented `partial_scores: false` rule rejects: the pillars that are
  missing are not missing at random. Deliberate (it keeps the map from going
  grey) but now inconsistent with the documented methodology. Needs a product
  call: either mark partial averages visually, or stop computing them.

## Resolved inputs

- ~~`conces` composite spec document.~~ Spec in place 2026-09-17. Contract key
  `mspi` landed 2026-09-19. ~~Coverage 117 vs HDI 193, confirm before live
  swap.~~ Rule 2026-09-24: exclude non-covered countries.
- ~~Revised index document.~~ Applied 2026-09-24. Three follow-up
  points (scope count, `mrnev=1`, version bump) closed 2026-09-29.
- ~~Service principal.~~ **Issued 2026-09-29:** the pipeline service principal, Storage Blob Data
  Contributor on the public payload container only, in PlanCatalyst's subscription
  (credentials in `.env`). A second principal holds the same role; its purpose is undocumented.
- ~~`popdens` display-direction confirmation.~~ Decision 2026-09-17: keep
  scored + inverted; dense countries display low. No code change.

## Acceptance (MVP)

1. Live Blob serves a post-fix snapshot and the hosted frontend reads it.
2. Wix iframe live on `plancatalyst.org`; all four routes work at iframe
   widths, mobile and desktop.
3. 28/28 indicators live, or an approved exception recorded in
   `indicators/SCORING_AUDIT.md`.
4. Handoff docs complete: `docs/runbook-refresh.md`, `RUNNING.md`,
   `HANDOFF.md`.
5. Release review recorded.

## Descoped / deferred

- Scheduled pipeline: not planned. Refresh runs as a manual Container Apps
  Job instead (requirements v2, section 3). Code landed 2026-10-14; the job
  itself is created by `infra/container-apps-job.sh`, which has not been run
  yet. Forecast publish stays manual; see `docs/runbook-refresh.md`.
- CI, dependency audits, container build verification, and CodeQL are active.
  Production dashboard deployment remains manual and environment-gated.
- Legacy 3-level compatibility CSVs: remove once confirmed unused.


## Forecasting MVP — merged 2026-09-15

- Quality gates, ARIMA intervals, atomic publish, projection UI, and the
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
