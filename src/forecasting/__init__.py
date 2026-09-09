"""World Bank raw-series forecasting with explicit unavailability.

PR B: one interval-producing model (ARIMA(1,1,0) + 95% CI). Never publishes
last-value carry-forward. Series that fail gates or unstable fits emit
forecast_unavailable + unavailable_reason instead of silent skips.
"""

from .engine import (
    UNAVAILABLE_UX,
    ForecastPoint,
    ForecastResult,
    forecast_series,
)
from .gates import GateResult, evaluate_series_gates

__all__ = [
    "UNAVAILABLE_UX",
    "ForecastPoint",
    "ForecastResult",
    "forecast_series",
    "GateResult",
    "evaluate_series_gates",
]
