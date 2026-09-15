"""Tests for projection-row validate_payload."""

from __future__ import annotations

import pytest

from src.projections.quality_gates import (
    REASON_INSUFFICIENT_OBSERVATIONS,
    UX_UNAVAILABLE_COPY,
)
from src.projections.validate import (
    ProjectionValidationError,
    ux_copy_for_reason,
    validate_payload,
    validate_row,
)


def _forecast_row(**overrides):
    row = {
        "iso3": "KEN",
        "indicator_code": "uhc",
        "year": 2027,
        "value": 62.0,
        "value_lo": 58.0,
        "value_hi": 66.0,
        "status": "forecast",
        "unavailable_reason": None,
    }
    row.update(overrides)
    return row


def _unavailable_row(**overrides):
    row = {
        "iso3": "KEN",
        "indicator_code": "uhc",
        "year": 2027,
        "value": None,
        "value_lo": None,
        "value_hi": None,
        "status": "unavailable",
        "unavailable_reason": REASON_INSUFFICIENT_OBSERVATIONS,
    }
    row.update(overrides)
    return row


def test_valid_forecast_and_unavailable_payload():
    validate_payload([_forecast_row(), _unavailable_row()])


def test_record_type_alias_accepted():
    row = _forecast_row()
    del row["status"]
    row["record_type"] = "forecast"
    validate_row(row)


def test_rejects_missing_status():
    row = _forecast_row()
    del row["status"]
    with pytest.raises(ProjectionValidationError, match="status or record_type"):
        validate_row(row)


def test_rejects_status_record_type_conflict():
    row = _forecast_row(status="forecast", record_type="unavailable")
    with pytest.raises(ProjectionValidationError, match="disagree"):
        validate_row(row)


def test_rejects_forecast_without_interval():
    row = _forecast_row()
    del row["value_lo"]
    del row["value_hi"]
    with pytest.raises(ProjectionValidationError, match="value_lo and value_hi"):
        validate_row(row)


def test_rejects_forecast_with_reason():
    row = _forecast_row(unavailable_reason=REASON_INSUFFICIENT_OBSERVATIONS)
    with pytest.raises(ProjectionValidationError, match="must not set unavailable_reason"):
        validate_row(row)


def test_rejects_inverted_interval():
    row = _forecast_row(value_lo=70.0, value_hi=60.0, value=65.0)
    with pytest.raises(ProjectionValidationError, match="value_lo .* > value_hi"):
        validate_row(row)


def test_rejects_value_outside_interval():
    row = _forecast_row(value=90.0, value_lo=58.0, value_hi=66.0)
    with pytest.raises(ProjectionValidationError, match="outside"):
        validate_row(row)


def test_forecast_value_optional():
    row = _forecast_row()
    del row["value"]
    validate_row(row)
    row2 = _forecast_row(value=None)
    validate_row(row2)


def test_rejects_unavailable_without_reason():
    row = _unavailable_row(unavailable_reason=None)
    with pytest.raises(ProjectionValidationError, match="require unavailable_reason"):
        validate_row(row)


def test_rejects_unknown_unavailable_reason():
    row = _unavailable_row(unavailable_reason="not_a_real_gate")
    with pytest.raises(ProjectionValidationError, match="not in"):
        validate_row(row)


def test_rejects_unavailable_with_numeric_fields():
    row = _unavailable_row(value=10.0)
    with pytest.raises(ProjectionValidationError, match="must leave value null"):
        validate_row(row)


def test_rejects_bad_iso3():
    row = _forecast_row(iso3="KENYA")
    with pytest.raises(ProjectionValidationError, match="iso3"):
        validate_row(row)


def test_rejects_non_int_year():
    row = _forecast_row(year=2027.5)  # type: ignore[arg-type]
    with pytest.raises(ProjectionValidationError, match="year"):
        validate_row(row)


def test_validate_payload_indexes_first_failure():
    good = _forecast_row()
    bad = _unavailable_row(unavailable_reason=None)
    with pytest.raises(ProjectionValidationError, match=r"projections\[1\]"):
        validate_payload([good, bad])


def test_ux_copy_for_any_reason():
    assert ux_copy_for_reason(REASON_INSUFFICIENT_OBSERVATIONS) == UX_UNAVAILABLE_COPY
    assert ux_copy_for_reason(None) == UX_UNAVAILABLE_COPY
    assert ux_copy_for_reason("anything") == UX_UNAVAILABLE_COPY
