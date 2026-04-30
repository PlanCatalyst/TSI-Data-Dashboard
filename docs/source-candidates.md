# Source Candidate Shortlist for Missing Indicators

## Purpose

Provide a pre-approved starting shortlist for Caroline so source work can proceed
without waiting on PM follow-up.

These candidates align with the client frontend blueprint:
`PlanCatalyst TSI Data Dashboard Final.html`.

## Indicator candidates

### `gii` (Gender Inequality Index)

- Primary candidate: UNDP Human Development Reports data portal / HDR datasets.
- Frontend source intent: "UNDP Human Development Reports".
- Notes:
  - normalize to stable country/year panel
  - confirm whether source scale is `0-1` and map to scoring formula in `indicators.yaml`

### `mpi` (Multidimensional Poverty Index)

- Primary candidate: UNDP Human Development Reports MPI datasets.
- Frontend source intent: "UNDP Human Development Reports".
- Notes:
  - maintain country/year coverage matrix and explicit nulls where no observation
  - preserve source provenance date/version in ingestion notes

### `ndgain` (ND-GAIN Vulnerability Index)

- Primary candidate: University of Notre Dame ND-GAIN Country Index bulk export.
- Frontend source intent: "University of Notre Dame".
- Notes:
  - complete composite vulnerability path from existing component inputs
  - confirm annual history coverage and missing-country handling

### `state` (State Capacity Index)

- Primary candidate: Our World in Data source path referenced in taxonomy/frontend.
- Frontend source intent: "Our World in Data".
- Notes:
  - document exact upstream dataset URL and licensing
  - define canonical field mapping and year handling in cleaner

### `conces` (Concessionality Index)

- Primary candidate: World Bank + IMF derived construction (multi-input index).
- Frontend source intent: "World Bank / IMF".
- Notes:
  - likely composite build from multiple metrics rather than a single API field
  - explicitly document formula and component weights before scorer wiring

## Required acceptance criteria per source

1. Source URL and version/date recorded.
2. Fetch and clean path committed in `src/fetch/` + `src/clean/`.
3. Country identity reconciled to `indicators/country_codes.csv` (`iso3` canonical).
4. Missing observations emitted as null-compatible values (no sentinel coercion).
5. Scorer/factory wiring completed or explicitly marked as blocking with owner + ETA.
