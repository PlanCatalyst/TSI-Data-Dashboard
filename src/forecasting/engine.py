"""Per-series forecast orchestration: PR A gates → ARIMA intervals or unavailable."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence

import numpy as np

from src.projections.quality_gates import (
    REASON_NO_SIGNAL,
    UX_UNAVAILABLE_COPY,
    assess_series,
)
from .models import MODEL_NAME, UnstableForecastFit, forecast_arima_110


# Re-export for callers / tests that still import the UX string from forecasting.
UNAVAILABLE_UX = UX_UNAVAILABLE_COPY


@dataclass(frozen=True)
class ForecastPoint:
    year: int
    value: Optional[float]
    value_lo: Optional[float]
    value_hi: Optional[float]


@dataclass(frozen=True)
class ForecastResult:
    """Outcome of forecasting one series.

    ``unavailable_reason`` is a machine GATE_REASONS code (or None when
    available). UX copy is always ``UX_UNAVAILABLE_COPY`` / ``UNAVAILABLE_UX``.
    """

    available: bool
    model_name: Optional[str]
    points: List[ForecastPoint]
    unavailable_reason: Optional[str]


def _clean_pairs(years: Sequence, values: Sequence) -> List[tuple]:
    pairs = []
    for y, v in zip(years, values):
        try:
            yi = int(y)
            vf = float(v)
        except (TypeError, ValueError):
            continue
        if not np.isfinite(vf):
            continue
        pairs.append((yi, vf))
    pairs.sort(key=lambda p: p[0])
    # Keep last observation per year if duplicates appear.
    dedup = {}
    for yi, vf in pairs:
        dedup[yi] = vf
    return sorted(dedup.items(), key=lambda p: p[0])


def _horizon_years(
    *,
    last_year: Optional[int],
    end_year: int,
    horizon: int,
) -> List[int]:
    """Calendar years for emitted rows. Never null — empty history anchors on end_year."""
    anchor = last_year if last_year is not None else int(end_year)
    return list(range(anchor + 1, anchor + 1 + horizon))


def _unavailable(
    *,
    reason_code: str,
    last_year: Optional[int],
    end_year: int,
    horizon: int,
) -> ForecastResult:
    years = _horizon_years(last_year=last_year, end_year=end_year, horizon=horizon)
    points = [
        ForecastPoint(year=y, value=None, value_lo=None, value_hi=None) for y in years
    ]
    return ForecastResult(
        available=False,
        model_name=None,
        points=points,
        unavailable_reason=reason_code,
    )


def forecast_series(
    years: Sequence,
    values: Sequence,
    *,
    horizon: int = 5,
    end_year: int,
    alpha: float = 0.05,
) -> ForecastResult:
    """Forecast one raw series.

    Always returns an explicit outcome: interval points **or** unavailable
    rows with a GATE_REASONS machine code. Never invents last-value
    carry-forward points. Eligibility uses ``assess_series`` (PR A) — do not
    pass parallel min_observations stand-ins.
    """
    if horizon < 1:
        raise ValueError("horizon must be >= 1")

    pairs = _clean_pairs(years, values)
    last_year = pairs[-1][0] if pairs else None

    # Pass cleaned + original-aligned year/value lists into assess_series.
    # assess_series expects aligned sequences (missing allowed as None/NaN);
    # we already dropped non-finite, so feed the cleaned pairs.
    gate = assess_series(
        [p[0] for p in pairs],
        [p[1] for p in pairs],
        end_year=int(end_year),
    )
    if not gate.ok:
        return _unavailable(
            reason_code=gate.unavailable_reason or REASON_NO_SIGNAL,
            last_year=last_year,
            end_year=end_year,
            horizon=horizon,
        )

    ys = [p[0] for p in pairs]
    vs = [p[1] for p in pairs]
    try:
        fyears, mean, lo, hi = forecast_arima_110(
            ys, vs, steps=horizon, alpha=alpha
        )
    except UnstableForecastFit:
        # Fit failure is not a separate GATE_REASONS code; treat as no usable signal.
        return _unavailable(
            reason_code=REASON_NO_SIGNAL,
            last_year=last_year,
            end_year=end_year,
            horizon=horizon,
        )

    points = [
        ForecastPoint(
            year=int(fy),
            value=float(m),
            value_lo=float(l),
            value_hi=float(h),
        )
        for fy, m, l, h in zip(fyears, mean, lo, hi)
    ]
    return ForecastResult(
        available=True,
        model_name=MODEL_NAME,
        points=points,
        unavailable_reason=None,
    )
