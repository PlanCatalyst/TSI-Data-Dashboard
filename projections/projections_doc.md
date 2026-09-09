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
explicit `forecast_unavailable` rows. Last-value carry-forward is **not** a
published forecast model.)

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

Column | Description
-------------------------------------------------------------------
country_code | ISO3 country code
country_name | Country name
indicator-code | Stable indicator code
indicator | Indicator display name
year | Forecast year (nullable only for empty-history markers)
value | Point forecast (null when unavailable)
value_lo | Lower 95% confidence bound (null when unavailable)
value_hi | Upper 95% confidence bound (null when unavailable)
record_type | "forecast"
generated_at | UTC timestamp of file generation
model_name | `arima_1_1_0` when available; null when unavailable
forecast_unavailable | true/false — never silently omit a series
unavailable_reason | UX copy when unavailable: "Forecast unavailable due to insufficient information."

# Integration Notes

- Use `record_type` to distinguish historical vs projected values.
- When `forecast_unavailable` is true, do not plot `value`; show the UX reason.
- Actuals and forecasts are intentionally stored in separate Blob paths.
