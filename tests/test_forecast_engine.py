"""PR B forecast engine: intervals, gate-fail, unstable-fit."""

from __future__ import annotations

import numpy as np
import pytest

from src.forecasting import UNAVAILABLE_UX, forecast_series
from src.forecasting.gates import evaluate_series_gates
from src.forecasting.models import UnstableForecastFit, forecast_arima_110


def _trend_series(n: int = 12, start_year: int = 2010):
    years = list(range(start_year, start_year + n))
    values = [10.0 + 0.5 * i + (0.05 * ((-1) ** i)) for i in range(n)]
    return years, values


def test_enough_data_emits_intervals():
    years, values = _trend_series(12)
    result = forecast_series(years, values, horizon=5, min_observations=5)

    assert result.available is True
    assert result.model_name == "arima_1_1_0"
    assert result.unavailable_reason is None
    assert len(result.points) == 5
    assert result.points[0].year == years[-1] + 1

    for pt in result.points:
        assert pt.value is not None
        assert pt.value_lo is not None
        assert pt.value_hi is not None
        assert np.isfinite(pt.value)
        assert pt.value_lo <= pt.value_hi


def test_gate_fail_insufficient_history_is_unavailable():
    years = [2018, 2019, 2020]
    values = [1.0, 2.0, 3.0]
    gate = evaluate_series_gates(years, values, min_observations=5)
    assert gate.passed is False
    assert gate.reason_code == "insufficient_history"

    result = forecast_series(years, values, horizon=3, min_observations=5)
    assert result.available is False
    assert result.model_name is None
    assert result.unavailable_reason == UNAVAILABLE_UX
    assert result.reason_code == "insufficient_history"
    assert len(result.points) == 3
    for pt in result.points:
        assert pt.value is None
        assert pt.value_lo is None
        assert pt.value_hi is None


def test_gate_fail_zero_variance_is_unavailable():
    years = list(range(2010, 2020))
    values = [42.0] * len(years)
    result = forecast_series(years, values, horizon=2, min_observations=5)
    assert result.available is False
    assert result.unavailable_reason == UNAVAILABLE_UX
    assert result.reason_code == "zero_variance"


def test_unstable_fit_is_unavailable(monkeypatch):
    years, values = _trend_series(10)

    def boom(*_args, **_kwargs):
        raise UnstableForecastFit("forced instability")

    monkeypatch.setattr(
        "src.forecasting.engine.forecast_arima_110",
        boom,
    )
    result = forecast_series(years, values, horizon=4, min_observations=5)
    assert result.available is False
    assert result.unavailable_reason == UNAVAILABLE_UX
    assert result.reason_code == "unstable_fit"
    assert all(pt.value is None for pt in result.points)


def test_arima_helper_returns_matching_shapes():
    years, values = _trend_series(15)
    fyears, mean, lo, hi = forecast_arima_110(years, values, steps=3)
    assert len(fyears) == len(mean) == len(lo) == len(hi) == 3
    assert int(fyears[0]) == years[-1] + 1


def test_never_uses_last_value_as_forecast():
    """Even a short series must not invent last-value points."""
    years, values = [2020, 2021], [100.0, 100.0]
    result = forecast_series(years, values, horizon=5, min_observations=5)
    assert result.available is False
    assert result.model_name is None
    # Values stay null — no carry-forward of 100.0
    assert all(pt.value is None for pt in result.points)
