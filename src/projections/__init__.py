"""Forecast / projection contract helpers (quality gates + payload validation).

PR A scope: series quality gates and pre-publish validation of interval
forecast rows. The forecast model (PR B) and orchestrator wiring (PR C) live
elsewhere.
"""

from src.projections.quality_gates import (
    GATE_REASONS,
    UX_UNAVAILABLE_COPY,
    GateResult,
    assess_series,
)
from src.projections.validate import (
    FORECAST_RECORD_TYPES,
    ProjectionValidationError,
    validate_payload,
)

__all__ = [
    "GATE_REASONS",
    "UX_UNAVAILABLE_COPY",
    "GateResult",
    "assess_series",
    "FORECAST_RECORD_TYPES",
    "ProjectionValidationError",
    "validate_payload",
]
