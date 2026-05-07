# temporary base.py to resolve import errors

from __future__ import annotations

from typing import Any

import pandas as pd


class IndicatorScorer:
    """Base class for indicator scorers.

    Provides helper methods used by concrete scorer implementations.
    """

    def clamp_0_100(self, values: Any) -> pd.Series:
        s = pd.Series(values)
        s = pd.to_numeric(s, errors="coerce")
        s = s.clip(lower=0.0, upper=100.0)
        return s

    def score(self, df: pd.DataFrame) -> pd.Series:  # pragma: no cover - abstract
        raise NotImplementedError()
