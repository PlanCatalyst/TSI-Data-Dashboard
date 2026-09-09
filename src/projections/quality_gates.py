"""Per iso3 × indicator series quality gates for forecasting eligibility.

A series that fails any gate must not emit a numeric forecast. Downstream
publishers emit an ``unavailable`` row instead, with ``unavailable_reason`` set
to one of the machine-readable codes below. Frontend UX copy is always the
shared string ``UX_UNAVAILABLE_COPY`` (see ``docs/data-contract.md``).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional, Sequence

import numpy as np

# Machine-readable gate failure codes (also valid unavailable_reason values).
REASON_INSUFFICIENT_OBSERVATIONS = "insufficient_observations"
REASON_INSUFFICIENT_SPAN = "insufficient_span"
REASON_STALE_SERIES = "stale_series"
REASON_TOO_SPARSE = "too_sparse"
REASON_NO_SIGNAL = "no_signal"

GATE_REASONS: frozenset[str] = frozenset(
    {
        REASON_INSUFFICIENT_OBSERVATIONS,
        REASON_INSUFFICIENT_SPAN,
        REASON_STALE_SERIES,
        REASON_TOO_SPARSE,
        REASON_NO_SIGNAL,
    }
)

# Shared UX string for any gate failure (frontend must not invent per-reason copy).
UX_UNAVAILABLE_COPY = "Forecast unavailable due to insufficient information."

# Thresholds (locked for the forecasting MVP; change only with a contract note).
MIN_OBSERVATIONS = 8
MIN_SPAN_YEARS = 8
STALE_LAG_YEARS = 3
MAX_MISSING_FRACTION = 0.4
# Scores live on a ~[0, 100] scale; treat sub-micro std as "flat line / no signal".
NEAR_ZERO_STD = 1e-8


@dataclass(frozen=True)
class GateResult:
    """Outcome of assessing one iso3 × indicator series."""

    ok: bool
    reasons: tuple[str, ...]
    n_obs: int
    span_years: Optional[int]
    last_year: Optional[int]
    missing_fraction: Optional[float]
    std: Optional[float]

    @property
    def unavailable_reason(self) -> Optional[str]:
        """Primary reason code for an unavailable row (first failure), or None."""
        return self.reasons[0] if self.reasons else None


def _as_float_or_nan(v: object) -> float:
    if v is None:
        return float("nan")
    try:
        if isinstance(v, (float, int, np.floating, np.integer)):
            f = float(v)
        else:
            f = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return float("nan")
    if np.isnan(f):
        return float("nan")
    return f


def assess_series(
    years: Sequence[int],
    values: Sequence[Optional[float]],
    *,
    end_year: int,
) -> GateResult:
    """Evaluate forecasting eligibility for one iso3 × indicator series.

    Parameters
    ----------
    years, values:
        Aligned sequences. ``values[i]`` is the observation for ``years[i]``;
        missing observations are ``None`` / NaN.
    end_year:
        Reference "as-of" year for the stale check (typically the latest year
        the historical contract publishes). A series is stale when its last
        non-null observation year is strictly less than ``end_year - 3``.

    Returns
    -------
    GateResult
        ``ok`` is True only when every gate passes. ``reasons`` lists every
        failed gate code (stable order defined below).
    """
    if len(years) != len(values):
        raise ValueError(
            f"years/values length mismatch: {len(years)} vs {len(values)}"
        )

    pairs: list[tuple[int, float]] = []
    for y, v in zip(years, values):
        yi = int(y)
        fv = _as_float_or_nan(v)
        if not np.isnan(fv):
            pairs.append((yi, fv))

    n_obs = len(pairs)
    reasons: list[str] = []

    if n_obs == 0:
        # Empty series fails every structural gate that can be evaluated.
        return GateResult(
            ok=False,
            reasons=(
                REASON_INSUFFICIENT_OBSERVATIONS,
                REASON_INSUFFICIENT_SPAN,
                REASON_STALE_SERIES,
                REASON_TOO_SPARSE,
                REASON_NO_SIGNAL,
            ),
            n_obs=0,
            span_years=None,
            last_year=None,
            missing_fraction=None,
            std=None,
        )

    obs_years = [p[0] for p in pairs]
    obs_vals = np.asarray([p[1] for p in pairs], dtype=float)
    first_year = min(obs_years)
    last_year = max(obs_years)
    # Span in calendar years between first and last observation (0 if single point).
    span_years = last_year - first_year
    # Missing fraction over the inclusive calendar window from first to last obs.
    window_len = span_years + 1
    missing_fraction = 1.0 - (n_obs / window_len) if window_len > 0 else 1.0
    std = float(np.std(obs_vals, ddof=0)) if n_obs > 0 else None

    # Gate order is stable and documented — keep in sync with docs/data-contract.md.
    if n_obs < MIN_OBSERVATIONS:
        reasons.append(REASON_INSUFFICIENT_OBSERVATIONS)
    if span_years < MIN_SPAN_YEARS:
        reasons.append(REASON_INSUFFICIENT_SPAN)
    if last_year < (end_year - STALE_LAG_YEARS):
        reasons.append(REASON_STALE_SERIES)
    if missing_fraction > MAX_MISSING_FRACTION:
        reasons.append(REASON_TOO_SPARSE)
    if std is None or std <= NEAR_ZERO_STD:
        reasons.append(REASON_NO_SIGNAL)

    return GateResult(
        ok=len(reasons) == 0,
        reasons=tuple(reasons),
        n_obs=n_obs,
        span_years=span_years,
        last_year=last_year,
        missing_fraction=missing_fraction,
        std=std,
    )


def assess_many(
    series: Iterable[tuple[str, str, Sequence[int], Sequence[Optional[float]]]],
    *,
    end_year: int,
) -> dict[tuple[str, str], GateResult]:
    """Assess many ``(iso3, indicator_code, years, values)`` series.

    Convenience helper for batch gate reports; not required for publish.
    """
    out: dict[tuple[str, str], GateResult] = {}
    for iso3, indicator_code, years, values in series:
        out[(iso3, indicator_code)] = assess_series(
            years, values, end_year=end_year
        )
    return out
