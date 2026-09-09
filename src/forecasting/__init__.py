"""World Bank raw-series forecasting with explicit unavailability.

PR B: one interval-producing model (ARIMA(1,1,0) + 95% CI). Never publishes
last-value carry-forward. Series that fail PR A ``assess_series`` gates or
unstable fits emit ``status``/``record_type`` ``"unavailable"`` with a
GATE_REASONS machine ``unavailable_reason`` (UX copy is ``UX_UNAVAILABLE_COPY``).
"""

from src.projections.quality_gates import GATE_REASONS, UX_UNAVAILABLE_COPY

from .engine import (
    UNAVAILABLE_UX,
    ForecastPoint,
    ForecastResult,
    forecast_series,
)

__all__ = [
    "GATE_REASONS",
    "UX_UNAVAILABLE_COPY",
    "UNAVAILABLE_UX",
    "ForecastPoint",
    "ForecastResult",
    "forecast_series",
]
