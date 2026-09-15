"""Validate interval-forecast / projection rows before publish.

Rejects illegal rows so a bad forecast payload cannot reach Azure. This is the
projection-side counterpart to ``src.upload.publish_dashboard.validate_payload``;
PR C wires it into the publish path. PR A only defines the gate.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Optional, Sequence

from src.projections.quality_gates import GATE_REASONS, UX_UNAVAILABLE_COPY

# Accepted status / record_type values for projection rows.
RECORD_TYPE_FORECAST = "forecast"
RECORD_TYPE_UNAVAILABLE = "unavailable"
FORECAST_RECORD_TYPES: frozenset[str] = frozenset(
    {RECORD_TYPE_FORECAST, RECORD_TYPE_UNAVAILABLE}
)

# Canonical field names for an interval forecast row (see docs/data-contract.md).
REQUIRED_FIELDS: frozenset[str] = frozenset(
    {
        "iso3",
        "indicator_code",
        "year",
        "value_lo",
        "value_hi",
        "unavailable_reason",
    }
)
# status and record_type are aliases; at least one must be present.
STATUS_FIELDS: tuple[str, ...] = ("status", "record_type")
# value is optional when unavailable or when only an interval is published.
OPTIONAL_FIELDS: frozenset[str] = frozenset({"value", "status", "record_type"})


class ProjectionValidationError(ValueError):
    """Raised when one or more projection rows violate the contract."""


def _row_label(index: int, row: Mapping[str, Any]) -> str:
    iso3 = row.get("iso3", "?")
    code = row.get("indicator_code", "?")
    year = row.get("year", "?")
    return f"projections[{index}] ({iso3}/{code}/{year})"


def _get_status(row: Mapping[str, Any]) -> Optional[str]:
    status = row.get("status", None)
    record_type = row.get("record_type", None)
    if status is None and record_type is None:
        return None
    if status is not None and record_type is not None and status != record_type:
        return "__conflict__"
    return status if status is not None else record_type


def _is_missing(v: object) -> bool:
    if v is None:
        return True
    # Guard against accidental NaN sneaking in from pandas.
    try:
        import math

        if isinstance(v, float) and math.isnan(v):
            return True
    except Exception:
        pass
    return False


def _as_number(v: object, *, field: str, label: str) -> float:
    if _is_missing(v):
        raise ProjectionValidationError(f"{label}: {field} must be a number, got null")
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise ProjectionValidationError(
            f"{label}: {field} must be numeric, got {v!r}"
        ) from exc


def validate_row(row: Mapping[str, Any], *, index: int = 0) -> None:
    """Validate a single projection row. Raises ProjectionValidationError."""
    if not isinstance(row, Mapping):
        raise ProjectionValidationError(
            f"projections[{index}]: row must be a mapping, got {type(row).__name__}"
        )

    label = _row_label(index, row)

    missing = [f for f in ("iso3", "indicator_code", "year") if f not in row]
    if missing:
        raise ProjectionValidationError(
            f"{label}: missing required field(s): {', '.join(missing)}"
        )

    iso3 = row["iso3"]
    if not isinstance(iso3, str) or len(iso3) != 3 or not iso3.isalpha():
        raise ProjectionValidationError(
            f"{label}: iso3 must be a 3-letter code, got {iso3!r}"
        )

    indicator_code = row["indicator_code"]
    if not isinstance(indicator_code, str) or not indicator_code.strip():
        raise ProjectionValidationError(
            f"{label}: indicator_code must be a non-empty string"
        )

    year = row["year"]
    if isinstance(year, bool) or not isinstance(year, int):
        # Reject bools (subclass of int) and non-ints; year must be calendar int.
        raise ProjectionValidationError(
            f"{label}: year must be an int calendar year, got {year!r}"
        )

    status = _get_status(row)
    if status is None:
        raise ProjectionValidationError(
            f"{label}: must set status or record_type to one of "
            f"{sorted(FORECAST_RECORD_TYPES)}"
        )
    if status == "__conflict__":
        raise ProjectionValidationError(
            f"{label}: status and record_type disagree "
            f"({row.get('status')!r} vs {row.get('record_type')!r})"
        )
    if status not in FORECAST_RECORD_TYPES:
        raise ProjectionValidationError(
            f"{label}: status/record_type={status!r} not in "
            f"{sorted(FORECAST_RECORD_TYPES)}"
        )

    value = row.get("value", None)
    value_lo = row.get("value_lo", None)
    value_hi = row.get("value_hi", None)
    unavailable_reason = row.get("unavailable_reason", None)

    if status == RECORD_TYPE_FORECAST:
        if not _is_missing(unavailable_reason):
            raise ProjectionValidationError(
                f"{label}: forecast rows must not set unavailable_reason "
                f"(got {unavailable_reason!r})"
            )
        # Interval bounds are required for a publishable forecast.
        if "value_lo" not in row or "value_hi" not in row:
            raise ProjectionValidationError(
                f"{label}: forecast rows require value_lo and value_hi"
            )
        lo = _as_number(value_lo, field="value_lo", label=label)
        hi = _as_number(value_hi, field="value_hi", label=label)
        if lo > hi:
            raise ProjectionValidationError(
                f"{label}: value_lo ({lo}) > value_hi ({hi})"
            )
        if not _is_missing(value):
            point = _as_number(value, field="value", label=label)
            if point < lo or point > hi:
                raise ProjectionValidationError(
                    f"{label}: value ({point}) outside [{lo}, {hi}]"
                )
        return

    # status == unavailable
    if _is_missing(unavailable_reason):
        raise ProjectionValidationError(
            f"{label}: unavailable rows require unavailable_reason"
        )
    if not isinstance(unavailable_reason, str):
        raise ProjectionValidationError(
            f"{label}: unavailable_reason must be a string, got "
            f"{unavailable_reason!r}"
        )
    if unavailable_reason not in GATE_REASONS:
        raise ProjectionValidationError(
            f"{label}: unavailable_reason={unavailable_reason!r} not in "
            f"{sorted(GATE_REASONS)}"
        )
    # Unavailable rows must not publish numeric point/interval estimates.
    for field, val in (("value", value), ("value_lo", value_lo), ("value_hi", value_hi)):
        if field in row and not _is_missing(val):
            raise ProjectionValidationError(
                f"{label}: unavailable rows must leave {field} null "
                f"(got {val!r})"
            )


def validate_payload(
    rows: Sequence[Mapping[str, Any]] | Iterable[Mapping[str, Any]],
) -> None:
    """Validate a full projection payload (list of interval forecast rows).

    Raises
    ------
    ProjectionValidationError
        On the first illegal row. Callers (publish) must abort upload so the
        previous live snapshot remains unchanged.
    """
    if rows is None:
        raise ProjectionValidationError("projections payload must not be None")

    # Materialise once so we can report length and index stably.
    materialised = list(rows)
    for i, row in enumerate(materialised):
        validate_row(row, index=i)


def ux_copy_for_reason(reason: Optional[str]) -> str:
    """Map any gate reason to the shared UX string (reason is for logs only)."""
    if reason is None:
        return UX_UNAVAILABLE_COPY
    if reason not in GATE_REASONS:
        # Still return the shared copy — never invent per-reason user text.
        return UX_UNAVAILABLE_COPY
    return UX_UNAVAILABLE_COPY
