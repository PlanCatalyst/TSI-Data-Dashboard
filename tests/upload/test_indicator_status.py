"""Contract §3.1 `indicatorStatus`: publisher emission and validation rule 6."""

from __future__ import annotations

import pandas as pd
import pytest

from src.calculating.mspi import STATUS_COLS
from src.upload.publish_dashboard import build_indicator_status, validate_payload


def _meta() -> dict:
    keys = [f"k{i}" for i in range(27)] + ["mspi"]
    return {
        "regions": [{"code": f"r{i}"} for i in range(8)],
        "pillars": [{"key": f"p{i}"} for i in range(7)],
        "subdomains": [{"key": f"s{i}"} for i in range(17)],
        "indicators": [{"key": k} for k in keys],
        "years": [2020, 2021],
    }


def _country(iso3: str, status: str, missing: list[str] | None = None) -> dict:
    return {
        "id": 1,
        "iso3": iso3,
        "name": iso3,
        "region": "r0",
        "scores": {"p0": 50.0},
        "overall": 50.0,
        "trend": [50.0, 50.0],
        "indicatorStatus": {"mspi": {"status": status, "missingComponents": missing or []}},
    }


def _timeseries(iso3: str, mspi: list) -> dict:
    keys = [ind["key"] for ind in _meta()["indicators"]]
    return {iso3: {k: (mspi if k == "mspi" else [None, None]) for k in keys}}


def test_build_indicator_status_reshapes_sidecar_and_splits_components():
    df = pd.DataFrame(
        [
            ("KEN", "mspi", "scored", ""),
            ("POL", "mspi", "incomplete_data", "debt_risk|concessionality"),
            ("USA", "mspi", "out_of_scope", ""),
        ],
        columns=STATUS_COLS,
    )
    out = build_indicator_status(df)
    assert out == {
        "KEN": {"mspi": {"status": "scored", "missingComponents": []}},
        "POL": {"mspi": {"status": "incomplete_data", "missingComponents": ["debt_risk", "concessionality"]}},
        "USA": {"mspi": {"status": "out_of_scope", "missingComponents": []}},
    }


def test_build_indicator_status_none_when_no_sidecar():
    assert build_indicator_status(None) is None
    assert build_indicator_status(pd.DataFrame(columns=STATUS_COLS)) is None


def test_validate_accepts_consistent_status():
    validate_payload(_meta(), [_country("KEN", "scored")], _timeseries("KEN", [40.0, None]))
    validate_payload(
        _meta(), [_country("POL", "incomplete_data", ["debt_risk"])], _timeseries("POL", [None, None])
    )
    validate_payload(_meta(), [_country("USA", "out_of_scope")], _timeseries("USA", [None, None]))


def test_validate_accepts_country_without_status():
    c = _country("KEN", "scored")
    del c["indicatorStatus"]
    validate_payload(_meta(), [c], _timeseries("KEN", [None, None]))


@pytest.mark.parametrize(
    ("status", "missing", "mspi_series", "fragment"),
    [
        ("bogus", [], [None, None], "invalid"),
        ("scored", [], [None, None], "all null"),
        ("out_of_scope", [], [40.0, None], "has values"),
        ("incomplete_data", [], [None, None], "non-empty"),
        ("scored", ["income"], [40.0, None], "non-empty"),
        ("incomplete_data", [""], [None, None], "non-empty strings"),
    ],
)
def test_validate_rejects_inconsistent_status(status, missing, mspi_series, fragment):
    with pytest.raises(ValueError, match=fragment):
        validate_payload(_meta(), [_country("KEN", status, missing)], _timeseries("KEN", mspi_series))


def test_validate_rejects_unknown_indicator_key():
    c = _country("KEN", "scored")
    c["indicatorStatus"] = {"nope": {"status": "scored", "missingComponents": []}}
    with pytest.raises(ValueError, match="not a contract indicator"):
        validate_payload(_meta(), [c], _timeseries("KEN", [None, None]))
