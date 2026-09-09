"""Minimal forecast quality gates (local stand-in until PR A merges)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np


# ARIMA(1,1,0) needs enough history after first differencing.
DEFAULT_MIN_OBSERVATIONS = 5


@dataclass(frozen=True)
class GateResult:
    passed: bool
    reason_code: Optional[str] = None


def evaluate_series_gates(
    years: Sequence,
    values: Sequence,
    *,
    min_observations: int = DEFAULT_MIN_OBSERVATIONS,
) -> GateResult:
    """Return whether a raw series is eligible for interval forecasting.

    Reasons are machine codes; the engine maps them to the UX string.
    """
    if min_observations < 2:
        raise ValueError("min_observations must be >= 2")

    ys = np.asarray(list(years), dtype=object)
    vs = np.asarray(list(values), dtype=object)
    if ys.size != vs.size:
        return GateResult(False, "malformed_series")

    year_num = []
    val_num = []
    for y, v in zip(ys.tolist(), vs.tolist()):
        try:
            yi = int(y)
        except (TypeError, ValueError):
            continue
        try:
            vf = float(v)
        except (TypeError, ValueError):
            continue
        if not np.isfinite(vf):
            continue
        year_num.append(yi)
        val_num.append(vf)

    if len(val_num) < min_observations:
        return GateResult(False, "insufficient_history")

    if len(set(year_num)) < min_observations:
        return GateResult(False, "insufficient_history")

    # Constant series → differenced ARIMA has nothing to estimate reliably.
    if float(np.nanmax(val_num) - np.nanmin(val_num)) == 0.0:
        return GateResult(False, "zero_variance")

    return GateResult(True, None)
