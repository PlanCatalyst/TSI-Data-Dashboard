# Frontend Implementation Brief

## Purpose

Turn the original UI mock (kept outside the repo) into a production React frontend
that preserves the approved design while mounting cleanly to the backend contract.

Status (2026-10-17): the app lives in `dashboard/` (React + Vite + D3) and is deployed to
Azure Static Web Apps, reading the live Blob contract (`deploy-dashboard.yml`, manual dispatch).
Production build, Azure hosting, live Blob publish and CORS are done. Remaining work is
presentability, Map/About polish, responsive QA at Wix iframe widths, and hosted E2E.

## Non-Negotiable Integration Rules

1. Frontend reads only contract files from Blob:
   - `meta.json`
   - `countries.json`
   - `timeseries.json`
   - `projections.json` only when a forecast run published it (off by default)
2. `docs/data-contract.md` is source of truth for payload semantics.
3. `iso3` is canonical join key across all frontend data joins.
4. Missing values remain `null` and must render as explicit no-data states.
5. Frontend-facing score orientation is always `higher_is_better`.
6. Projections are disabled for MVP (`meta.projections.enabled === false` path).

## Product Blueprint Source

Use the original UI mock (kept outside the repo) as the UI/feature blueprint:

- page structure
- visual hierarchy
- interactions
- filter logic
- detail panel behavior

Keep parity tight unless implementation constraints force change; when they do,
document the change in PR notes and preserve user intent.

## React App Structure (Recommended)

```text
dashboard/
  src/
    app/
      routes/              # ExplorePage, ComparePage, MapPage, about/ (AboutPage), TrendsPanel
      layout/              # shell, nav, iframe-safe wrappers
    components/
      tables/
      charts/
      map/
      panels/
      states/              # loading/empty/error
    data/
      contract/
        types.ts           # typed models for meta/countries/timeseries
        loaders.ts         # fetch + parse + runtime guards
        selectors.ts       # memoized derived view data
      formatters.ts
    state/
      dashboard-context.tsx
    styles/
      tokens.css
```

## Contract Mounting Plan

### 1) Boot sequence

1. Fetch `meta.json` first.
2. Validate schema version and required key counts.
3. Fetch `countries.json` and `timeseries.json` in parallel.
4. Build a single app data context for view consumption.
5. Fail gracefully with a visible retry state if contract load fails.

### 2) Runtime validation

At minimum, frontend guards should verify:

- expected keys exist in each payload
- all `countries.iso3` keys exist in `timeseries`
- timeseries indicator keys align with `meta.indicators`
- array lengths align with `meta.years`

### 3) Derived data location

Client-side derivations should live in selectors/utilities (not scattered in UI):

- subdomain means
- regional means
- rankings/sorts/filter subsets
- chart series assembly

## View-Level Direction

### Explore

- Country table with filters + trend sparkline.
- Nulls display as unavailable values, never coerced to zero.
- Uses `countries.json` as primary source.

### Compare

- Multi-country comparison using contract scores.
- Shared filter logic and deterministic sorting.

### Map

- Choropleth keyed by numeric country id for map geometry.
- Detail drilldown joins through `iso3`.

### About

- Contract metadata from `meta.json` (generated time, run id, schema version).

## UX State Requirements

Must be explicitly designed and implemented for:

1. Initial loading
2. Partial/null-heavy data
3. Contract mismatch/error
4. Empty-filter results
5. Projections disabled banner/state

## Theming and Visual Parity

1. Lift colors/labels/domain mapping from `meta.json` where applicable.
2. Keep visual intent from the original HTML mock for:
   - typography hierarchy
   - panel composition
   - chart/map emphasis
   - interaction rhythm
3. Ensure responsive behavior across desktop/tablet/mobile with no layout breakage.

## Remaining work

- mock parity and presentability on all four pages
- responsive QA vs HTML mock
- missing-indicator UX (sparse pillars; `mspi` is live with an `indicatorStatus` status model)
- hosted E2E verification (Wix + Azure Blob JSON)
- fresh contract JSON after pipeline runs (manual refresh, `docs/runbook-refresh.md`)
- ~~production build (`npm run build`)~~, ~~live Blob publish and `VITE_CONTRACT_BASE_URL`~~,
  ~~Azure frontend hosting + CORS~~: done

## Definition of Done for Frontend Mounting

1. App runs against Blob-hosted `/v1/*.json` with no local hardcoded fallback in production.
2. All major views map to contract data and match the original mock's intent.
3. Contract-load failures are visible/recoverable (no blank screen).
4. Null and disabled-projection states are intentional and QA-verified.
5. Frontend requires no direct read of pipeline CSVs.
