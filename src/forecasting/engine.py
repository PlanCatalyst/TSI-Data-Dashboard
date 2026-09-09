"""Per-series forecast orchestration: gates → ARIMA intervals or unavailable."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence

import numpy as np

from .gates import DEFAULT_MIN_OBSERVATIONS, evaluate_series_gates
from .models import MODEL_NAME, UnstableForecastFit, forecast_arima_110


UNAVAILABLE_UX = "Forecast unavailable due to insufficient information."


@dataclass(frozen=True)
class ForecastPoint:
    year: int
    value: Optional[float]
    value_lo: Optional[float]
    value_hi: Optional[float]


@dataclass(frozen=True)
class ForecastResult:
    available: bool
    model_name: Optional[str]
    points: List[ForecastPoint]
    unavailable_reason: Optional[str]
    reason_code: Optional[str]


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


def _unavailable(
    *,
    reason_code: str,
    last_year: Optional[int],
    horizon: int,
) -> ForecastResult:
    points: List[ForecastPoint] = []
    if last_year is not None and horizon > 0:
        for y in range(last_year + 1, last_year + 1 + horizon):
            points.append(ForecastPoint(year=y, value=None, value_lo=None, value_hi=None))
    return ForecastResult(
        available=False,
        model_name=None,
        points=points,
        unavailable_reason=UNAVAILABLE_UX,
        reason_code=reason_code,
    )


def forecast_series(
    years: Sequence,
    values: Sequence,
    *,
    horizon: int = 5,
    min_observations: int = DEFAULT_MIN_OBSERVATIONS,
    alpha: float = 0.05,
) -> ForecastResult:
    """Forecast one raw series.

    Always returns an explicit outcome: interval points **or**
    ``forecast_unavailable`` semantics via ``available=False`` + UX reason.
    Never invents last-value carry-forward points.
    """
    if horizon < 1:
        raise ValueError("horizon must be >= 1")

    pairs = _clean_pairs(years, values)
    last_year = pairs[-1][0] if pairs else None

    gate = evaluate_series_gates(
        [p[0] for p in pairs],
        [p[1] for p in pairs],
        min_observations=min_observations,
    )
    if not gate.passed:
        return _unavailable(
            reason_code=gate.reason_code or "gate_failed",
            last_year=last_year,
            horizon=horizon,
        )

    ys = [p[0] for p in pairs]
    vs = [p[1] for p in pairs]
    try:
        fyears, mean, lo, hi = forecast_arima_110(
            ys, vs, steps=horizon, alpha=alpha
        )
    except UnstableForecastFit:
        return _unavailable(
            reason_code="unstable_fit",
            last_year=last_year,
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
        reason_code=None,
    )
