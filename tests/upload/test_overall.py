"""countries[].overall is null when any pillar is null (data contract)."""
from __future__ import annotations

import pandas as pd

from src.upload.publish_dashboard import _PILLAR_KEYS, PublishInputs, build_countries


def _inputs(rows: list[tuple[str, int, str, float]]) -> PublishInputs:
    codes = pd.DataFrame(
        [("AAA", 1, "Alpha", "SSA"), ("BBB", 2, "Beta", "SSA")],
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


def test_overall_null_when_a_pillar_is_missing():
    # AAA has all seven pillars; BBB lacks pri. Need 40 publishes as score 60.
    rows = [("AAA", 2020, pk, 40.0) for pk in _PILLAR_KEYS]
    rows += [("BBB", 2020, pk, 40.0) for pk in _PILLAR_KEYS if pk != "pri"]
    by_iso3 = {c["iso3"]: c for c in build_countries(_inputs(rows))}

    assert by_iso3["AAA"]["overall"] == 60.0
    assert by_iso3["AAA"]["trend"] == [60.0]
    assert by_iso3["BBB"]["scores"]["pri"] is None
    assert by_iso3["BBB"]["overall"] is None
    assert by_iso3["BBB"]["trend"] == [None]
