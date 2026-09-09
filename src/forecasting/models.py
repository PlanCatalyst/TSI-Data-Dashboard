"""Single interval-producing model: ARIMA(1,1,0) with 95% confidence intervals."""

from __future__ import annotations

from typing import Sequence, Tuple

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA


MODEL_NAME = "arima_1_1_0"
DEFAULT_ALPHA = 0.05  # 95% CI


class UnstableForecastFit(RuntimeError):
    """Raised when the model fit or interval forecast is not usable."""


def forecast_arima_110(
    years: Sequence[int],
    values: Sequence[float],
    *,
    steps: int,
    alpha: float = DEFAULT_ALPHA,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Fit ARIMA(1,1,0) and return (forecast_years, mean, lo, hi).

    ``lo`` / ``hi`` are the ``alpha`` confidence interval bounds from
    statsmodels ``get_forecast(...).conf_int()``.
    """
    if steps < 1:
        raise ValueError("steps must be >= 1")

    y_idx = pd.PeriodIndex([int(y) for y in years], freq="Y")
    y = pd.Series(np.asarray(values, dtype=float), index=y_idx, name="value")
    y = y.sort_index()
    if y.index.has_duplicates:
        raise UnstableForecastFit("duplicate years in series")

    try:
        fitted = ARIMA(y, order=(1, 1, 0)).fit()
        pred = fitted.get_forecast(steps=steps)
        mean = np.asarray(pred.predicted_mean, dtype=float)
        ci = np.asarray(pred.conf_int(alpha=alpha), dtype=float)
    except Exception as exc:  # statsmodels raises varied numerical errors
        raise UnstableForecastFit(str(exc)) from exc

    if ci.ndim != 2 or ci.shape != (steps, 2):
        raise UnstableForecastFit("confidence interval shape mismatch")
    if mean.shape != (steps,):
        raise UnstableForecastFit("forecast mean shape mismatch")
    if not np.all(np.isfinite(mean)) or not np.all(np.isfinite(ci)):
        raise UnstableForecastFit("non-finite forecast or intervals")

    lo_raw = ci[:, 0]
    hi_raw = ci[:, 1]
    # Enforce lo <= hi when floating noise swaps bounds.
    lo = np.minimum(lo_raw, hi_raw)
    hi = np.maximum(lo_raw, hi_raw)
    last_year = int(y.index[-1].year)
    forecast_years = np.arange(last_year + 1, last_year + 1 + steps, dtype=int)
    return forecast_years, mean, lo, hi
