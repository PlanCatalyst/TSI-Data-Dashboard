from __future__ import annotations

import pandas as pd
import pytest

from src.validation.rules import Inputs, r1_unique_country_year_series, r3_alternating_series, r10_agoda_unit_sanity, r11_location_totals, r4_flat_runs, r6_basket_presence
from src.validation.run import DataQualityError, evaluate, run_validation, write_report


def _scored(rows):
    return pd.DataFrame(rows, columns=["country_code", "country_name", "year", "series_code", "value", "score", "floored_to_zero"])


def test_r3_catches_the_adolescent_birth_sawtooth():
    rows = [(iso, iso, 2010 + i, "SP_DYN_ADKL", 1.0, 0.0 if i % 2 == 0 else 69.0, False)
            for iso in ("BRA", "KEN", "VEN") for i in range(10)]
    x = Inputs(scored=_scored(rows), pillars=pd.DataFrame(), subdomains=pd.DataFrame())
    f = list(r3_alternating_series(x))
    assert f and f[0].severity == "block" and f[0].issue == "DQ-02"


def test_r3_single_country_sawtooth_warns_not_blocks():
    rows = [("NIU", "Niue", 2010 + i, "SH_TBS_INCD", 1.0, 0.0 if i % 2 == 0 else 80.0, False) for i in range(10)]
    x = Inputs(scored=_scored(rows), pillars=pd.DataFrame(), subdomains=pd.DataFrame())
    f = list(r3_alternating_series(x))
    assert f and f[0].severity == "warn" and f[0].issue == "DQ-09"


def test_r3_smooth_series_is_clean():
    rows = [("BRA", "Brazil", 2010 + i, "X", 1.0, 30.0 + i, False) for i in range(10)]
    x = Inputs(scored=_scored(rows), pillars=pd.DataFrame(), subdomains=pd.DataFrame())
    assert list(r3_alternating_series(x)) == []


def test_r4_flat_run_with_moving_source_warns():
    rows = [("RUS", "Russia", 2000 + i, "ND_GAIN_VULN", 0.30 + i / 100, 0.0, True) for i in range(12)]
    x = Inputs(scored=_scored(rows), pillars=pd.DataFrame(), subdomains=pd.DataFrame())
    f = list(r4_flat_runs(x))
    assert f and f[0].severity == "warn" and f[0].issue == "DQ-01"


def test_r1_conflicting_duplicates_block():
    df = _scored([("KEN", "Kenya", 2015, "S", 1.0, 1.0, False), ("KEN", "Kenya", 2015, "S", 9.0, 9.0, False)])
    x = Inputs(scored=df, pillars=pd.DataFrame(), subdomains=pd.DataFrame())
    assert list(r1_unique_country_year_series(x))[0].severity == "block"


def test_r6_requires_basket_columns():
    x = Inputs(scored=_scored([]), pillars=pd.DataFrame({"pillar_score": [1.0]}), subdomains=pd.DataFrame({"subdomain_score": [1.0]}))
    assert all(f.severity == "block" for f in r6_basket_presence(x))


def test_run_validation_blocks_and_writes_report(tmp_path):
    rows = [(iso, iso, 2010 + i, "SP_DYN_ADKL", 1.0, 0.0 if i % 2 == 0 else 69.0, False)
            for iso in ("BRA", "KEN", "VEN") for i in range(10)]
    _scored(rows).to_csv(tmp_path / "Indicator_Scores_Full.csv", index=False)
    pd.DataFrame({"country_code": ["BRA"], "country_name": ["Brazil"], "year": [2019], "pillar_key": ["health"],
                  "pillar_score": [10.0], "subdomain_count": [1], "basket_size": [1]}).to_csv(tmp_path / "pillarscores.csv", index=False)
    pd.DataFrame({"country_code": ["BRA"], "country_name": ["Brazil"], "year": [2019], "pillar_key": ["health"], "subdomain_key": ["repro"],
                  "subdomain_score": [10.0], "indicator_count": [1], "basket_size": [1]}).to_csv(tmp_path / "subdomainscores.csv", index=False)
    with pytest.raises(DataQualityError):
        run_validation(tmp_path, log=lambda s: None)
    assert (tmp_path / "data_quality_report.md").exists()
    assert (tmp_path / "data_quality_report.json").exists()


def test_r10_blocks_agoda_value_above_one():
    df = _scored([("CUB", "Cuba", 2020, "DC_TOF_AGRL", 0.0004, 98.0, False), ("CUB", "Cuba", 2021, "DC_TOF_AGRL", 27.1, 0.0, False)])
    x = Inputs(scored=df, pillars=pd.DataFrame(), subdomains=pd.DataFrame())
    f = list(r10_agoda_unit_sanity(x))
    assert len(f) == 1 and f[0].severity == "block" and f[0].issue == "DQ-10"


def test_r10_clean_when_ratios_or_nan():
    df = _scored([("CUB", "Cuba", 2020, "DC_TOF_AGRL", 0.0004, 98.0, False), ("CUB", "Cuba", 2021, "DC_TOF_AGRL", float("nan"), float("nan"), False)])
    x = Inputs(scored=df, pillars=pd.DataFrame(), subdomains=pd.DataFrame())
    assert list(r10_agoda_unit_sanity(x)) == []


def test_r11_blocks_urban_row_when_series_has_allarea_elsewhere():
    df = _scored([("KEN", "Kenya", 2015, "SH_H2O_SAFE", 60.0, 50.0, False), ("ARG", "Argentina", 2017, "SH_H2O_SAFE", 48.4, 20.0, False)])
    df["location"] = ["ALLAREA", "URBAN"]
    x = Inputs(scored=df, pillars=pd.DataFrame(), subdomains=pd.DataFrame())
    f = list(r11_location_totals(x))
    assert len(f) == 1 and f[0].country == "ARG" and f[0].severity == "block" and f[0].issue == "DQ-11"


def test_r11_allows_blank_and_series_without_the_total():
    df = _scored([("KEN", "Kenya", 2015, "A", 1.0, 1.0, False), ("BRA", "Brazil", 2015, "A", 2.0, 2.0, False),
                  ("KEN", "Kenya", 2015, "MMR", 1.0, 1.0, False)])
    df["location"] = ["ALLAREA", None, "URBAN"]
    df["sex"] = [None, None, "FEMALE"]
    x = Inputs(scored=df, pillars=pd.DataFrame(), subdomains=pd.DataFrame())
    assert list(r11_location_totals(x)) == []
