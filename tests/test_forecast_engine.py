"""PR B forecast engine: intervals, PR A gate-fail, unstable-fit → §8 rows."""

from __future__ import annotations

import numpy as np
import pytest

from src.forecasting import UNAVAILABLE_UX, forecast_series
from src.forecasting.models import UnstableForecastFit, forecast_arima_110
from src.projections.quality_gates import (
    GATE_REASONS,
    MIN_OBSERVATIONS,
    REASON_INSUFFICIENT_OBSERVATIONS,
    REASON_NO_SIGNAL,
    UX_UNAVAILABLE_COPY,
    assess_series,
)
from src.projections.validate import validate_payload


def _trend_series(n: int = 12, start_year: int = 2010):
    years = list(range(start_year, start_year + n))
    values = [10.0 + 0.5 * i + (0.05 * ((-1) ** i)) for i in range(n)]
    return years, values


def _rows_from_result(result, *, iso3="KEN", indicator_code="uhc"):
    """Build §8 validate_payload rows from a ForecastResult."""
    rows = []
    status = "forecast" if result.available else "unavailable"
    for pt in result.points:
        rows.append(
            {
                "iso3": iso3,
                "indicator_code": indicator_code,
                "year": int(pt.year),
                "value": pt.value,
                "value_lo": pt.value_lo,
                "value_hi": pt.value_hi,
                "status": status,
                "record_type": status,
                "unavailable_reason": result.unavailable_reason,
            }
        )
    return rows


def test_enough_data_emits_intervals():
    # 2010..2021 = 12 obs, span 11, last=2021, end_year=2024 → not stale (2021 >= 2021).
    years, values = _trend_series(12, start_year=2010)
    result = forecast_series(years, values, horizon=5, end_year=2024)

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

    validate_payload(_rows_from_result(result))


def test_gate_fail_insufficient_observations_is_unavailable():
    years = [2018, 2019, 2020]
    values = [1.0, 2.0, 3.0]
    gate = assess_series(years, values, end_year=2024)
    assert gate.ok is False
    assert REASON_INSUFFICIENT_OBSERVATIONS in gate.reasons
    assert gate.unavailable_reason in GATE_REASONS

    result = forecast_series(years, values, horizon=3, end_year=2024)
    assert result.available is False
    assert result.model_name is None
    assert result.unavailable_reason == gate.unavailable_reason
    assert result.unavailable_reason in GATE_REASONS
    # UX copy is the shared constant — not stuffed into unavailable_reason.
    assert result.unavailable_reason != UX_UNAVAILABLE_COPY
    assert UNAVAILABLE_UX == UX_UNAVAILABLE_COPY
    assert len(result.points) == 3
    for pt in result.points:
        assert isinstance(pt.year, int)
        assert pt.value is None
        assert pt.value_lo is None
        assert pt.value_hi is None

    validate_payload(_rows_from_result(result))


def test_gate_fail_no_signal_is_unavailable():
    # Flat line long enough to pass count/span/stale/sparsity → no_signal.
    years = list(range(2010, 2023))  # 13 obs, span 12, last=2022, end_year=2024
    values = [42.0] * len(years)
    gate = assess_series(years, values, end_year=2024)
    assert gate.ok is False
    assert REASON_NO_SIGNAL in gate.reasons

    result = forecast_series(years, values, horizon=2, end_year=2024)
    assert result.available is False
    assert result.unavailable_reason == REASON_NO_SIGNAL
    assert result.unavailable_reason in GATE_REASONS
    validate_payload(_rows_from_result(result))


def test_unstable_fit_maps_to_no_signal(monkeypatch):
    years, values = _trend_series(12, start_year=2010)

    def boom(*_args, **_kwargs):
        raise UnstableForecastFit("forced instability")

    monkeypatch.setattr(
        "src.forecasting.engine.forecast_arima_110",
        boom,
    )
    result = forecast_series(years, values, horizon=4, end_year=2024)
    assert result.available is False
    assert result.unavailable_reason == REASON_NO_SIGNAL
    assert all(pt.value is None for pt in result.points)
    validate_payload(_rows_from_result(result))


def test_arima_helper_returns_matching_shapes():
    years, values = _trend_series(15)
    fyears, mean, lo, hi = forecast_arima_110(years, values, steps=3)
    assert len(fyears) == len(mean) == len(lo) == len(hi) == 3
    assert int(fyears[0]) == years[-1] + 1


def test_never_uses_last_value_as_forecast():
    """Even a short series must not invent last-value points."""
    years, values = [2020, 2021], [100.0, 100.0]
    result = forecast_series(years, values, horizon=5, end_year=2024)
    assert result.available is False
    assert result.model_name is None
    assert result.unavailable_reason in GATE_REASONS
    # Values stay null — no carry-forward of 100.0
    assert all(pt.value is None for pt in result.points)
    assert all(isinstance(pt.year, int) for pt in result.points)
    validate_payload(_rows_from_result(result))


def test_empty_history_emits_horizon_years_not_null():
    result = forecast_series([], [], horizon=5, end_year=2024)
    assert result.available is False
    assert result.unavailable_reason in GATE_REASONS
    assert len(result.points) == 5
    assert [pt.year for pt in result.points] == [2025, 2026, 2027, 2028, 2029]
    assert all(pt.value is None for pt in result.points)
    validate_payload(_rows_from_result(result))


def test_uses_a_thresholds_not_min_obs_5():
    """A series with 5–7 obs fails A's MIN_OBSERVATIONS=8 (not B's old min_obs=5)."""
    assert MIN_OBSERVATIONS == 8
    years = list(range(2018, 2024))  # 6 years
    values = [float(i) for i in range(len(years))]
    result = forecast_series(years, values, horizon=2, end_year=2024)
    assert result.available is False
    assert result.unavailable_reason == REASON_INSUFFICIENT_OBSERVATIONS
