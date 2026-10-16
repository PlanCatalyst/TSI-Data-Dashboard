from __future__ import annotations

import pandas as pd

from src.calculating.dimensions import conflicting_duplicates, select_dimensions


def _rows(*recs):
    cols = ["country_code", "year", "series_code", "value", "age", "sex", "location", "quantile", "education_level", "class_code"]
    return pd.DataFrame([dict(zip(cols, r)) for r in recs])


def test_adolescent_births_keep_15_to_19_only():
    df = _rows(
        ("BRA", 2010, "SP_DYN_ADKL", 3.2, "10-14", "FEMALE", "ALLAREA", None, None, None),
        ("BRA", 2010, "SP_DYN_ADKL", 63.1, "15-19", "FEMALE", "ALLAREA", None, None, None),
        ("BRA", 2011, "SP_DYN_ADKL", 3.3, "10-14", "FEMALE", "ALLAREA", None, None, None),
        ("BRA", 2011, "SP_DYN_ADKL", 64.2, "15-19", "FEMALE", "ALLAREA", None, None, None),
    )
    out = select_dimensions(df).sort_values("year")
    assert out["value"].tolist() == [63.1, 64.2]
    assert conflicting_duplicates(out).empty


def test_ihr_capacities_average_per_year():
    df = _rows(*[("KEN", 2010, "SH_IHR_CAPS", v, None, None, None, None, None, f"IHR{i:02d}") for i, v in enumerate([0.0, 100.0, 50.0], 1)])
    out = select_dimensions(df)
    assert len(out) == 1
    assert out["value"].iloc[0] == 50.0
    assert out["class_code"].iloc[0] == "MEAN"


def test_generic_totals_preferred_and_identical_dupes_collapse():
    df = _rows(
        ("KEN", 2015, "SH_DYN_MORT", 40.0, "ALLAGE", "BOTHSEX", "ALLAREA", None, None, None),
        ("KEN", 2015, "SH_DYN_MORT", 44.0, "ALLAGE", "MALE", "ALLAREA", None, None, None),
        ("KEN", 2016, "EG_ACS_ELEC", 70.0, None, None, "ALLAREA", None, None, None),
        ("KEN", 2016, "EG_ACS_ELEC", 70.0, None, None, "ALLAREA", None, None, None),
    )
    out = select_dimensions(df)
    assert len(out) == 2
    assert out.set_index("series_code").loc["SH_DYN_MORT", "value"] == 40.0


def test_conflicting_rows_are_left_for_the_validator():
    df = _rows(
        ("KEN", 2015, "NEW_SERIES", 1.0, "0-4", "BOTHSEX", "ALLAREA", None, None, None),
        ("KEN", 2015, "NEW_SERIES", 9.0, "5-9", "BOTHSEX", "ALLAREA", None, None, None),
    )
    out = select_dimensions(df)
    assert len(out) == 2
    assert len(conflicting_duplicates(out)) == 2


def test_bank_account_ownership_keeps_adults_15_plus_total():
    df = _rows(
        ("KEN", 2021, "FB_BNK_ACCSS", 79.2, "15+", "BOTHSEX", "ALLAREA", "_T", "_T", None),
        ("KEN", 2021, "FB_BNK_ACCSS", 83.2, "15+", "MALE", "ALLAREA", "_T", "_T", None),
        ("KEN", 2021, "FB_BNK_ACCSS", 87.0, "15+", "BOTHSEX", "ALLAREA", "R60", "_T", None),
        ("KEN", 2021, "FB_BNK_ACCSS", 61.0, "15+", "BOTHSEX", "ALLAREA", "_T", "AGG_0_1", None),
        ("KEN", 2021, "FB_BNK_ACCSS", 79.3, "25+", "BOTHSEX", "ALLAREA", "_T", "_T", None),
    )
    out = select_dimensions(df)
    assert len(out) == 1 and out["value"].iloc[0] == 79.2


def test_lone_urban_row_is_dropped_when_series_has_allarea_elsewhere():
    df = _rows(
        ("KEN", 2015, "SH_H2O_SAFE", 60.0, None, None, "ALLAREA", None, None, None),
        ("ARG", 2017, "SH_H2O_SAFE", 48.4, None, None, "URBAN", None, None, None),
    )
    out = select_dimensions(df)
    assert out["country_code"].tolist() == ["KEN"]


def test_female_only_series_survives_and_blank_dimensions_are_kept():
    df = _rows(
        ("KEN", 2015, "SH_STA_MORT", 300.0, None, "FEMALE", "ALLAREA", None, None, None),
        ("BRA", 2015, "SH_STA_MORT", 60.0, None, "FEMALE", None, None, None, None),
        ("KEN", 2015, "NO_DIM", 5.0, None, None, None, None, None, None),
    )
    out = select_dimensions(df)
    assert len(out) == 3
