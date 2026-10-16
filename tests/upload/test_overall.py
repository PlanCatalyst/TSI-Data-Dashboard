"""countries[].overall: null when a core pillar is null, pri is optional (data contract)."""
from __future__ import annotations

import pandas as pd

from src.upload.publish_dashboard import _PILLAR_KEYS, PublishInputs, build_countries


def _inputs(rows: list[tuple[str, int, str, float]]) -> PublishInputs:
    codes = pd.DataFrame(
        [("AAA", 1, "Alpha", "SSA"), ("BBB", 2, "Beta", "SSA"), ("CCC", 3, "Gamma", "SSA")],
        columns=["iso3", "iso_numeric", "name", "wb_region_code"],
    )
    pillars = pd.DataFrame(rows, columns=["country_code", "year", "pillar_key", "pillar_score"])
    return PublishInputs(
        yaml_cfg={},
        country_codes=codes,
        pillar_scores=pillars,
        subdomain_scores=pd.DataFrame(),
        indicator_scores=pd.DataFrame(),
        years=[2020],
        pipeline_run_id="test",
    )


def _build(rows):
    return {c["iso3"]: c for c in build_countries(_inputs(rows))}


def test_overall_is_seven_pillar_mean_when_all_present():
    # Need 40 publishes as score 60.
    rows = [("AAA", 2020, pk, 40.0) for pk in _PILLAR_KEYS]
    c = _build(rows)["AAA"]
    assert c["overall"] == 60.0
    assert c["trend"] == [60.0]


def test_overall_present_when_only_pri_is_missing():
    rows = [("AAA", 2020, pk, 40.0) for pk in _PILLAR_KEYS]
    rows += [("BBB", 2020, pk, 20.0) for pk in _PILLAR_KEYS if pk != "pri"]
    c = _build(rows)["BBB"]
    assert c["scores"]["pri"] is None
    assert c["overall"] == 80.0
    assert c["trend"] == [80.0]


def test_overall_null_when_a_core_pillar_is_missing():
    rows = [("AAA", 2020, pk, 40.0) for pk in _PILLAR_KEYS]
    rows += [("CCC", 2020, pk, 40.0) for pk in _PILLAR_KEYS if pk != "ag"]
    c = _build(rows)["CCC"]
    assert c["scores"]["ag"] is None
    assert c["overall"] is None
    assert c["trend"] == [None]
