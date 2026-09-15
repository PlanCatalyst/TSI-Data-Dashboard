## World Bank Blob Output Documentation
# Overview

The **processed** data folder holds **projections of indicator progress** (alongside historical actuals for the same indicators). The processing stage generates two CSV files for World Bank data:

- Historical actuals
- Forecasted projections (interval forecasts **or** explicit unavailability)

These outputs are structured for direct consumption in Power BI / downstream publish and stored in clearly separated Blob paths.

### Blob Paths
# Actuals
processed/worldbank/actuals/world_bank_actuals.csv

(Contains historical observed values only.)

# Forecasts (Projections)
processed/worldbank/forecasts/world_bank_forecasts.csv

(Contains ARIMA(1,1,0) interval projections with 95% confidence bounds, or
explicit `unavailable` rows per `docs/data-contract.md` §8. Last-value
carry-forward is **not** a published forecast model.)

# File Format

## Actuals

Column | Description
-------------------------------------------------------------------
country_code | ISO3 country code
country_name | Country name
indicator-code | Stable indicator code (e.g., EN.POP.DNST)
indicator | Indicator display name
year | Year of observation
value | Numeric value
record_type | "actual"
generated_at | UTC timestamp of file generation

## Forecasts

Authoritative field list for dashboard publish: `docs/data-contract.md` §8.
Rows are validated by `src.projections.validate.validate_payload`.

Column | Description
-------------------------------------------------------------------
iso3 | 3-letter ISO 3166-1 alpha-3 join key
indicator_code | Stable indicator / series code
year | Integer forecast year (never null; empty-history uses horizon years)
value | Point forecast (null when unavailable)
value_lo | Lower 95% CI bound (null when unavailable)
value_hi | Upper 95% CI bound (null when unavailable)
status / record_type | `"forecast"` or `"unavailable"`
generated_at | UTC timestamp of file generation
model_name | `arima_1_1_0` when available; null when unavailable
unavailable_reason | Machine gate code from GATE_REASONS when unavailable; null on forecast rows

# Integration Notes

- Use `status`/`record_type` to distinguish `"forecast"` vs `"unavailable"`.
- Join on `iso3` and `indicator_code` for stable relationships.
- When status is `"unavailable"`, do not plot value/lo/hi; show UX copy
  `UX_UNAVAILABLE_COPY` ("Forecast unavailable due to insufficient information.").
  `unavailable_reason` is the machine gate code for logs only.
- Actuals and forecasts are intentionally stored in separate Blob paths.
- Gate eligibility is `src.projections.quality_gates.assess_series` — do not
  parallel-implement thresholds in the forecast engine.
