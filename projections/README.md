# Projections

Workspace for projections / forecasting research and (eventually) production
projection code. This is the projections research
lane: method comparison → quality report → ship/no-ship recommendation →
output spec for a future contract extension.

## Current state

**PR B (`feat/forecast-engine`):** production path is `src/forecasting/` +
`projections/process_data.py`. Model = ARIMA(1,1,0) with 95% CI
(`value` / `value_lo` / `value_hi`). Gate failures and unstable fits emit
`forecast_unavailable` + UX reason — never last-value, never silent skip.
Orchestrator toggle: `runtime.run_forecasts` (default `false`).


The only thing here right now is **prior work** carried over from the old
PlanCatalyst repo (`LlamzonAmazon/PC-Data-Dash`, `src/processing/`). It is
reference material, **not runnable** against the current pipeline — see
"Why the prior code isn't wired in" below. New research notebooks and any
future projection code will live in this folder too.

## Prior work in this folder

| File | What it is | Why it's worth keeping |
|------|-----------|------------------------|
| `worldbankforecasting.ipynb` | Research notebook: per-country ARIMA(1,1,0) vs Holt-Winters (additive trend, no seasonality) vs last-value baseline, with outlier flagging by error quantile. | Captures the **method comparison** decisions — which models were tried, which were ruled out, where they failed. |
| `UNSDGforecasting.ipynb` | Same comparison applied to UN SDG indicator series. | Confirms the same baselines were tested across sources, not just World Bank. |
| `NDGAINforecasting.ipynb` | Same comparison applied to ND-GAIN indicator series. | Shows ND-GAIN was already known to be harder to forecast (largely static / long-horizon projections — see `MODULE-README.md`). |
| `worldbankforecastingfinal.py` | "Production-style" script extracted from the WB notebook: per-country ARIMA(1,1,0), forecasts 2027–2029, writes CSV. | The closest the old team got to a shippable forecast. Reference for the chosen parameters. |
| `process_data.py` | `ProcessData` class: emits actuals + **last-value-carry-forward** forecasts with `record_type` / `model_name` columns. Uploads to `processed/worldbank/{actuals,forecasts}/` on Azure. | Shows the old contract shape and the no-skill baseline that any real model must beat. |
| `projections_doc.md` | Old documentation: schema for the actuals/forecasts CSVs, Power BI integration notes. | Documents the **old contract**, which predates the current `docs/data-contract.md` v1. |
| `forecasts.csv` | Sample forecast output (~17 KB). | Lets you eyeball what the old outputs actually looked like. |
| `MODULE-README.md` | The old `src/processing/README.md`. Explains composite index construction (sector scores, vulnerability index, readiness) and the forecasting rationale. | Source of truth for the original methodology narrative. |

## Methodology summary (the part worth inheriting)

Three baselines were compared in the notebooks:

1. **ARIMA(1,1,0)** — autoregressive with 1 lag, first-differenced (handles
   linear trend), no moving-average term. Cheap, reasonable for noisy
   non-stationary series. The "production" script picked this.
2. **Holt-Winters exponential smoothing** with additive trend, no seasonality.
   Different failure mode than ARIMA — better when the trend is stable but the
   series is short.
3. **Last-value carry-forward** — the no-skill baseline. Anything that can't
   beat this isn't worth shipping.

Outlier detection uses **error quantiles** (`Q1 - 1.5 * IQR`, `Q3 + 1.5 * IQR`)
on per-country prediction errors for each model; countries above the upper
fence are flagged. This is useful for the future quality report ("which
countries can't be forecast credibly?").

## Why the prior code isn't wired in

The old code reads legacy paths and schema that don't exist in this repo:

- Reads `data/interim/world_bank_interim.csv` with columns `country`, `value`
  (this repo uses `data/interim/validated/...` with ISO3 and scored values).
- Writes `processed/worldbank/{actuals,forecasts}/*.csv` to Azure
  (this repo's publish boundary is `dashboard-public/v1/{meta,countries,timeseries}.json`
  — see `docs/data-contract.md`).
- Operates on raw indicator values, not on scored `[0, 100]` series. The
  current contract publishes scored data; deciding whether to project raw or
  scored values is an open question (see "Open methodology questions" below).

## How this slots into the current contract

`docs/data-contract.md` §2 already reserves the projection hook:

```json
"projections": { "enabled": false, "firstProjectedYear": null, "note": "Projection band coming soon." }
```

When projections are ready to ship, this flag flips and either `timeseries.json`
gets projected positions appended (with nulls past `firstProjectedYear` for
indicators that can't be forecast) or a parallel array is added (contract
change → /v1→/v2). That decision belongs to whoever owns the publisher
(currently Christina).

## Open methodology questions (for the next research pass)

1. **Project raw or scored values?** Raw preserves scorer semantics but means
   re-applying scorers per forecast year. Scored is simpler but ARIMA on a
   bounded [0, 100] series can extrapolate outside the bound.
2. **Per-indicator or per-pillar?** Old work was per-indicator. The dashboard's
   `countries.json.trend[]` is per-country overall — projecting at that level
   would be smaller surface but loses indicator detail.
3. **What's the minimum series length?** Old code used `len(df_subset) < 5` to
   skip. Worth re-evaluating with the current scored output's actual coverage.
4. **How to expose uncertainty?** Old work emits point forecasts only. The
   client mock's "projection band" implies an interval, not a line.

## Production quality gates (PR A)

Runnable gate + validation code lives under **`src/projections/`** (not this
research folder):

| Module | Role |
|--------|------|
| `src/projections/quality_gates.py` | Per `iso3 × indicator` eligibility: `insufficient_observations`, `insufficient_span`, `stale_series`, `too_sparse`, `no_signal` |
| `src/projections/validate.py` | `validate_payload` — rejects illegal interval forecast rows before publish |

Contract fields and UX copy are documented in `docs/data-contract.md` §8.
Forecast **model** work is PR B. PR C wires §8 emit into
`src/upload/publish_dashboard.py` (validate via `src.projections.validate_payload`,
upload `projections.json`, then `meta.json` last). Do not reintroduce last-value
carry-forward from `process_data.py` into the live path.

Tests: `pytest tests/projections/`.

## See also

- `TASKS.md`: projections are deferred post-MVP with no ship target.
- `docs/data-contract.md` §2 — current `projections` meta hook.
- `docs/PRINCIPLES.md` §4 — "Projection Transparency" principle: blank
  projections must be explained to users.