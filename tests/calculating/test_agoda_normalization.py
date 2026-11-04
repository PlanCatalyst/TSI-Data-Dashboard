from __future__ import annotations

import pandas as pd

from src.calculating.pipeline import _apply_agoda_gdp_normalization


def _frame(*recs):
    return pd.DataFrame(recs, columns=["country_code", "year", "series_code", "value"])


def test_agoda_converts_to_ratio_when_gdp_present():
    # anchor year 2022: KD[2022] == CD[2022], so KD[2015]/KD[2022]*CD[2022]
    # rebases to the same 1,000,000,000.0 figure used by the raw ratio below.
    df = _frame(
        ("KEN", 2015, "DC_TOF_AGRL", 20.0),
        ("KEN", 2015, "NY.GDP.MKTP.KD", 1_000_000_000.0),
        ("KEN", 2022, "NY.GDP.MKTP.KD", 1_000_000_000.0),
        ("KEN", 2022, "NY.GDP.MKTP.CD", 1_000_000_000.0),
    )
    out = _apply_agoda_gdp_normalization(df)
    assert out.loc[out["series_code"] == "DC_TOF_AGRL", "value"].iloc[0] == 0.02


def test_agoda_missing_gdp_for_year_becomes_nan():
    df = _frame(
        ("KEN", 2015, "DC_TOF_AGRL", 20.0),
        ("KEN", 2016, "DC_TOF_AGRL", 27.1),
        ("KEN", 2015, "NY.GDP.MKTP.KD", 1_000_000_000.0),
        # no 2016 NY.GDP.MKTP.KD row, so 2016 has no rebased GDP
        ("KEN", 2022, "NY.GDP.MKTP.KD", 1_000_000_000.0),
        ("KEN", 2022, "NY.GDP.MKTP.CD", 1_000_000_000.0),
    )
    out = _apply_agoda_gdp_normalization(df).query("series_code == 'DC_TOF_AGRL'").set_index("year")["value"]
    assert out[2015] == 0.02 and pd.isna(out[2016])


def test_agoda_missing_anchor_year_becomes_nan_for_every_year():
    # KD exists for the aid year but not for the 2022 anchor, so the country
    # has no rebased GDP in any year (decided 2026-11-03).
    df = _frame(
        ("KEN", 2015, "DC_TOF_AGRL", 20.0),
        ("KEN", 2015, "NY.GDP.MKTP.KD", 1_000_000_000.0),
        ("KEN", 2015, "NY.GDP.MKTP.CD", 1_000_000_000.0),
    )
    out = _apply_agoda_gdp_normalization(df)
    assert pd.isna(out.loc[out["series_code"] == "DC_TOF_AGRL", "value"].iloc[0])


def test_agoda_zero_gdp_becomes_nan():
    df = _frame(("KEN", 2015, "DC_TOF_AGRL", 20.0), ("KEN", 2015, "NY.GDP.MKTP.CD", 0.0))
    out = _apply_agoda_gdp_normalization(df)
    assert pd.isna(out.loc[out["series_code"] == "DC_TOF_AGRL", "value"].iloc[0])


def test_agoda_with_no_gdp_at_all_becomes_nan():
    df = _frame(("KEN", 2015, "DC_TOF_AGRL", 20.0), ("KEN", 2015, "OTHER", 7.0))
    out = _apply_agoda_gdp_normalization(df)
    assert pd.isna(out.loc[out["series_code"] == "DC_TOF_AGRL", "value"].iloc[0])
    assert out.loc[out["series_code"] == "OTHER", "value"].iloc[0] == 7.0
