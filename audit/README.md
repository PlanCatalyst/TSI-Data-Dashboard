# Independent data audit (2026-10-14)

Purpose: re-derive every dashboard number from the raw source files with code
that does not import the pipeline, then reconcile against what the dashboard
serves. The pipeline is the thing under test; nothing here may call it.

## Fork point

`data/raw/` is the raw snapshot the pipeline read (`runtime.fetch_raw: false`).
Every published number has a raw record there.

## Rules for derivation scripts (`audit/derive_<source>.py`)

1. No `import src...`. Read raw files, `indicators/indicators.yaml`,
   `indicators/SCORING_AUDIT.md`, `indicators/country_codes.csv`. Benchmarks
   and formulas come from the yaml first; `src/calculating/factory.py` may be
   read as the second source of the constants, and any disagreement between
   the two is a finding.
2. Output one CSV per source at `audit/expected/<source>.csv` with columns
   `iso3,year,indicator_key,raw_value,expected_score,note`.
   `expected_score` is the dashboard orientation: `round(100 - need, 1)`,
   higher is better, in [0, 100]. Missing raw value: no row.
3. Scoring mode is `clamp` (v1 rule, `scoring.below_benchmark: clamp`).
4. Write `audit/findings/<source>.md`: records dropped and why, dimension
   choices made, spec ambiguities, anything in the raw data itself that looks
   wrong.

## Reconciliation

`audit/reconcile.py` compares every expected row with `dashboard/public/v1/`
and writes `audit/results/summary.md` and `audit/results/mismatches.csv`.
Tolerance 0.15 (one-decimal rounding). Classes: match, mismatch,
missing_in_dashboard, extra_in_dashboard.
