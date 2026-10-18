# CLAUDE.md reference — detail moved from CLAUDE.md on 2026-10-14

These sections were moved verbatim from `CLAUDE.md` to keep it under 5 KB. CLAUDE.md points here; rules below still apply.

## Repository Layout

Two top-level deliverables in one repo:

- **`src/`** - Python data pipeline (the backend). Stages: `fetch/`, `archive/` (raw store), `clean/`, `calculating/`, `validation/`, `upload/`, optional `forecasting/` and `projections/`, orchestrated by `pipeline/`; shared helpers in `utils/`. Config lives in `src/config/settings.yaml`.
- **`dashboard/`** — React + TypeScript + Vite frontend. Reads only the published contract JSON; never reads pipeline CSVs. Page routes live in `dashboard/src/app/routes/` (`AboutPage`, `ComparePage`, `ExplorePage`, `MapPage`, `TrendsPanel`); shared UI in `dashboard/src/components/` (`charts/`, `map/`, `panels/`, `states/`, `tables/`); contract loaders in `dashboard/src/data/`.
- **`indicators/`** — taxonomy source of truth: `indicators.yaml` (pillar/subdomain/indicator hierarchy), `country_codes.csv` (canonical name + iso3 + numeric id), `SCORING_AUDIT.md` (scoring direction + known gaps).
- **`docs/`** — `data-contract.md` (authoritative payload schema), `PRINCIPLES.md`, `repo-architecture.md`.
- **`scripts/`** — ad-hoc utilities (one-off conversions, debugging helpers). Not part of the production pipeline; safe to edit without contract concerns.
- **`data/`** - local-only artifacts: `raw/` (per-source raw payloads), `store/<run_id>/` (immutable raw store per run), `clean/` (per-source cleaned CSVs), `interim/validated/` (scored), `organized/` (local pre-publish JSON in `dry_run`), `processed/`.

## Pipeline Architecture

```
fetch -> raw store -> clean -> score/aggregate -> validate (blocking) -> upload validated -> forecasts (off by default) -> publish contract JSON -> Azure Blob -> React frontend -> Wix iframe
```

Stages are orchestrated by `src/pipeline/orchestrator.py` (entered via `src/pipeline/run_pipeline.py`):

1. **Fetch** (`src/fetch/`) - abstract-factory clients for UN SDG (API), World Bank (API), ND-GAIN (local ZIP, or the newest ZIP from the private ND-GAIN source Blob container when `NDGAIN_BLOB_CONTAINER` is set), UNDP HDR (static CSV/XLSX), and World Bank WGI (static XLSX). Per-source raw payloads land under `data/raw/<source>/` when `runtime.save_raw: true`.
2. **Raw store** (`src/archive/store.py`) - archives the fetched raw payloads under `data/store/<run_id>/` (see `docs/raw-data-store.md`), right after fetch.
3. **Clean** (`src/clean/`) - same factory pattern; outputs tidy per-source CSVs under `data/clean/<source>/`. Cleaner output schema is `country_code, country_name, year, value, indicator, series_code` (plus source-specific extras). Rows whose `series_code` isn't registered in `IndicatorScorerFactory` persist in the CSV but are defensively skipped by scoring.
4. **Calculating** (`src/calculating/`) - `pipeline.run_pipeline` reads the UN SDG cleaned CSV plus any additional interim CSVs listed under `runtime.interim_data` (ND-GAIN, UNDP HDR, WGI, etc.), concatenates them, applies per-`series_code` scorers via `IndicatorScorerFactory`, then aggregates to subdomain and pillar via `pillar_aggregate.py`. Writes `Indicator_Scores_Full.csv`, `indicatorscores/*.csv`, `subdomainscores.csv`, `pillarscores.csv` under `data/interim/validated/`. Dimension and `mspi` composition live in `dimensions.py` and `mspi.py`.
5. **Data validation** (`src/validation/`) - blocking gate: a failure stops the run before anything is uploaded or published.
6. **Upload** (`src/upload/upload_validated.py`) - pushes the validated CSVs to the private Azure container (`azure.container_name`) when `runtime.upload_azure: true`.
7. **Forecast/Publish** - optional forecast processing (`src/forecasting`, `src/projections`) runs only when
   `runtime.run_forecasts: true` (off by default; `projections.json` is published only on such a run), then `src/upload/publish_dashboard.py`
   validates and publishes contract payloads atomically with `meta.json` last.

### The publish boundary is the only place orientation flips

The pipeline emits **vulnerability-oriented** scores ("higher = more need") all the way through `data/interim/validated/`. The publish step converts to dashboard orientation (`higher_is_better`) via `published = round(100 - pipeline_score, 1)`. Do not invert anywhere else; do not "fix" scorers in `src/calculating/` to flip direction. See `indicators/SCORING_AUDIT.md`.

### Indicator taxonomy bridges two naming worlds

`src/calculating/pillar_taxonomy.py` is the single source mapping:

- yaml/frontend world: `frontend_key` (e.g. `"uhc"`, `"tb"`) inside `health, ag, si, women, climate, ctx, pri`.
- pipeline world: source-specific `series_code` (e.g. `"SH_ACS_UNHC_25"`, `"EN.POP.DNST"`).

SDG indicators bridge automatically through `SDG_ID_TO_SERIES_CODE`; non-SDG indicators (gii, ndgain, mpi, popdens, state, mspi) bridge through `NON_SDG_FRONTEND_KEY_TO_SERIES_CODE`. When wiring a new source, add its `series_code` to one of these maps so pillar aggregation picks it up automatically.

## Key Dev-Loop Knobs (`src/config/settings.yaml`)

- `runtime.fetch_raw: false` — skip API calls, reuse existing `data/raw/` files. **Default in this repo; set to `true` only when fetching fresh upstream data.** UN SDG fetch is slow and rate-limited; avoid unnecessary re-fetches.
- `runtime.upload_azure: false` — disable Azure upload for local dry runs.
- `runtime.save_raw` / `runtime.save_cleaned` — control whether raw/clean CSVs persist to disk between stages.
- `runtime.interim_data.<source>` — paths to cleaned CSVs that downstream stages consume.
- `azure.container_name` vs `publish.dashboard_container_name` (both in `src/config/settings.yaml`) - backend artifacts vs frontend payloads. They are different containers with different access policies.

Azure auth: `.env` at repo root with `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_STORAGE_ACCOUNT_URL`. Never commit `.env`.

## Caution Areas

- UN SDG fetch is slow and rate-limited. Run with `runtime.fetch_raw: false` unless you specifically need fresh data.
- Some UN SDG indicators (e.g. 3.d.1 IHR capacity) require per-dimension fetch; configured in `src/config/unsdg_indicator_classes.yaml` (`fetch_by_dimension: true`).
- Null-heavy countries are expected for some indicators; do not coerce to zero to make a chart render.
- Keep indicator key mappings synchronized with `indicators/indicators.yaml`. New indicators should arrive with fetch + clean + scorer wiring (or an explicit "blocked, owner X, ETA Y" entry in `SCORING_AUDIT.md`).
- Don't reintroduce the legacy 3-level (domain/sector/subsector) hierarchy as the primary contract shape. Compatibility CSVs may exist transitionally; the contract is 7 pillars × 17 subdomains × 28 indicators.

## Current Known Gaps

From `indicators/SCORING_AUDIT.md`, and the vault context (as of 2026-09-19):

- **Coverage: 28/28 indicators flow end-to-end.** `gii`, `mpi`, `ndgain`, `state` live since
  2026-05-17. `pri/macrosec` contract key is `mspi` as of 2026-09-19, backed by
  `MSPI_INDEX` (`src/calculating/mspi.py`). Issues #3 (`agoda`),
  #4 (`susag`), #5 (`clean`) and #6 (`popdens` verification) were all closed 2026-07-07.
- **Live Blob republished 2026-09-29** (`pipelineRunId: refresh-20260929`) with the
  2026-07-07 scoring fixes, `mspi`, and the additive `indicatorStatus` field. The hosted
  frontend was redeployed the same day and renders it.
- **Publish credentials exist locally.** `.env` at repo root holds the four `AZURE_*` values
  for the pipeline service principal (Storage Blob Data Contributor on the
  public payload container only). Never commit or print it.
- `conces` / macrosec: the `hdi` substitution was dropped (2026-08-13) and
  the composite is specified in `docs/spec-macrosec-index.md` (2026-09-17).
  Contract key **`mspi`** landed 2026-09-19. Composer wired and scored
  (`MSPI_INDEX`: 117 countries vs HDI 193 in 2010–2024). **Coverage rule
  since 2026-09-24:** non-covered countries are excluded rather than
  substituted, so the all-or-nothing null rule stands and `mspi` is cleared to
  replace `hdi` in the live snapshot. Remaining: About-page copy naming the
  excluded set, and confirming rank/compare views treat a null `pri` as
  excluded, not last place. **The spec was revised 2026-09-24**
  (summarized in `docs/spec-macrosec-index.md`). It was **implemented** in `src/calculating/mspi.py`:
  an IDS scope rule resolved from World Bank `lendingType.id`, a three-value
  `status` field (`scored` / `out_of_scope` / `incomplete_data`), every country
  present in the output, and `partial_scores: false`, surfaced through the
  additive contract `indicatorStatus` field. `mspi` is live (republished
  2026-09-29). `docs/spec-macrosec-index.md` carries the spec diff.
- `popdens`: **resolved as scored** (2026-08-13) and **display direction fixed**
  (2026-09-17). Bands are byte-identical to `DensityScorer`. Keep scored + inverted; dense
  countries display low. No code change.
- ~~Stale `data/clean/unsdg/un_sdg_clean.csv` using numeric UN M49 country codes.~~
  **Closed 2026-09-24.** Verified on disk: 234 distinct `country_code` values,
  all ISO3, zero numeric. The 2026-07-07 cleaner re-run already fixed it; the
  gap note outlived the gap.
- **Frontend deployed** to Azure SWA.
  CI supplies the production Blob URL explicitly. Production deployment is a
  manually dispatched, CI-gated workflow and requires the
  `AZURE_STATIC_WEB_APPS_API_TOKEN` secret in the GitHub `production`
  environment (set 2026-09-29; recovery steps in `docs/runbook-refresh.md`). The SWA is in
  PlanCatalyst's subscription.
- **Storage account ownership (2026-09-29).** The storage account sits in
  PlanCatalyst's subscription. No
  migration. The public payload container is the only anonymous container (level Blob);
  the backend artifacts container, the other data containers and `$logs` are private. The pipeline principal
  has rights on the public payload container only, so `runtime.upload_azure` for validated CSVs stays off
  unless a second scoped role is granted.
- **Containerised refresh: coded, not yet provisioned.** The 2026-09-04 descope was superseded. `infra/container-apps-job.sh` defines the manual-trigger Azure Container Apps Job (system-assigned identity with Storage Blob Data Contributor + AcrPull, 3h timeout, failure email alert); its image comes from `scripts/acr_build.sh` (`docs/docker.md`). There is no cron: the six-month cadence is a human routine, and manual publish from a workstation (`docs/runbook-refresh.md`) still works.
