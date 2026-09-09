"""Tests for per-series forecasting quality gates."""

from __future__ import annotations

import pytest

from src.projections.quality_gates import (
    MIN_OBSERVATIONS,
    MIN_SPAN_YEARS,
    REASON_INSUFFICIENT_OBSERVATIONS,
    REASON_INSUFFICIENT_SPAN,
    REASON_NO_SIGNAL,
    REASON_STALE_SERIES,
    REASON_TOO_SPARSE,
    UX_UNAVAILABLE_COPY,
    assess_series,
)


def _years(start: int, end: int) -> list[int]:
    return list(range(start, end + 1))


def test_ux_copy_is_stable():
    assert UX_UNAVAILABLE_COPY == (
        "Forecast unavailable due to insufficient information."
    )


def test_healthy_series_passes():
    # 2014..2023 inclusive = 10 obs, span 9, last=2023, end_year=2024 → not stale.
    years = _years(2014, 2023)
    values = [float(i) for i in range(len(years))]  # rising → variance
    result = assess_series(years, values, end_year=2024)
    assert result.ok is True
    assert result.reasons == ()
    assert result.n_obs == 10
    assert result.span_years == 9
    assert result.last_year == 2023
    assert result.unavailable_reason is None


def test_insufficient_observations():
    years = _years(2016, 2023)  # 8 years calendar but only 7 obs
    values = [1.0, 2.0, 3.0, None, 5.0, 6.0, 7.0, 8.0]  # 7 obs
    # Force fewer than MIN_OBSERVATIONS with adequate span via sparse fill later.
    years = _years(2010, 2023)
    values = [None] * len(years)
    for i, y in enumerate(years):
        if y in (2010, 2012, 2014, 2016, 2018, 2020, 2023):
            values[i] = float(y)  # 7 observations, span 13
    result = assess_series(years, values, end_year=2024)
    assert result.ok is False
    assert REASON_INSUFFICIENT_OBSERVATIONS in result.reasons
    assert result.n_obs == 7
    assert result.n_obs < MIN_OBSERVATIONS


def test_insufficient_span():
    years = _years(2018, 2023)  # span 5 (< 8), 6 obs
    values = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0]
    result = assess_series(years, values, end_year=2024)
    assert result.ok is False
    assert REASON_INSUFFICIENT_SPAN in result.reasons
    assert result.span_years == 5
    assert result.span_years < MIN_SPAN_YEARS


def test_stale_series():
    # last_year=2019, end_year=2024 → 2019 < 2024-3=2021 → stale
    years = _years(2010, 2019)
    values = [float(i) for i in range(len(years))]
    result = assess_series(years, values, end_year=2024)
    assert result.ok is False
    assert REASON_STALE_SERIES in result.reasons
    assert result.last_year == 2019


def test_not_stale_at_boundary():
    # last_year == end_year - 3 → not stale (strictly less than)
    years = _years(2012, 2021)
    values = [float(i) for i in range(len(years))]
    result = assess_series(years, values, end_year=2024)
    assert REASON_STALE_SERIES not in result.reasons


def test_too_sparse():
    # Window 2010..2023 = 14 years; 8 obs → missing_fraction = 6/14 ≈ 0.429 > 0.4
    years = _years(2010, 2023)
    values = [None] * len(years)
    keep = {2010, 2012, 2014, 2016, 2018, 2020, 2022, 2023}
    for i, y in enumerate(years):
        if y in keep:
            values[i] = float(y)
    result = assess_series(years, values, end_year=2024)
    assert result.ok is False
    assert REASON_TOO_SPARSE in result.reasons
    assert result.missing_fraction is not None
    assert result.missing_fraction > 0.4


def test_no_signal_near_zero_variance():
    years = _years(2014, 2023)
    values = [42.0] * len(years)
    result = assess_series(years, values, end_year=2024)
    assert result.ok is False
    assert REASON_NO_SIGNAL in result.reasons


def test_empty_series_fails_all_structural_gates():
    years = _years(2014, 2023)
    values = [None] * len(years)
    result = assess_series(years, values, end_year=2024)
    assert result.ok is False
    assert REASON_INSUFFICIENT_OBSERVATIONS in result.reasons
    assert REASON_INSUFFICIENT_SPAN in result.reasons
    assert REASON_STALE_SERIES in result.reasons
    assert REASON_TOO_SPARSE in result.reasons
    assert REASON_NO_SIGNAL in result.reasons


def test_length_mismatch_raises():
    with pytest.raises(ValueError, match="length mismatch"):
        assess_series([2014, 2015], [1.0], end_year=2024)
