"""Collapse UN SDG disaggregations to one row per (country, year, series)
BEFORE scoring (data quality issue DQ-02).

Eleven SDG series arrive with several rows per country-year (sex, age,
location, quantile, education, or a class code). The publisher used to keep
"BOTHSEX / ALLAREA / _T / ALLAGE when present" and then take the first
remaining row, which is arbitrary when no total exists. Adolescent births
(SP_DYN_ADKL) alternated between the 10 to 14 and 15 to 19 bands by year,
and IHR capacity (SH_IHR_CAPS) picked one of 13 capacities. Both read as
zigzags on the dashboard.

Rules, applied in order:
  1. Per-series overrides in SERIES_RULES (explicit band, or mean over a
     dimension).
  2. Generic totals: BOTHSEX, ALLAREA, quantile _T, education _T, ALLAGE.
     Per series and per column: if the series has the total in that column
     anywhere (any country, any year), keep only rows holding the total or a
     blank, so a lone URBAN row cannot pass as the national value. A series
     that never has the total in a column (female-only series) is left alone.
  3. Whatever is still duplicated with IDENTICAL values collapses to one row.
     Duplicates with DIFFERENT values are left in place for validation rule
     R1 to block, so a new disaggregation can never silently pick a row.
"""
from __future__ import annotations

from typing import Any

import pandas as pd

DIMENSION_COLUMNS = ("sex", "location", "quantile", "education_level", "age", "class_code")

# series_code -> rule. "keep": {column: value} keeps only matching rows.
# "mean_over": column averages the value across that dimension per year.
SERIES_RULES: dict[str, dict[str, Any]] = {
    # SDG 3.7.2 is births per 1,000 women aged 15 to 19; the benchmark (20)
    # is on that scale. The 10 to 14 band is a separate series.
    "SP_DYN_ADKL": {"keep": {"age": "15-19"}},
    # SDG 3.d.1 is the average of the 13 IHR core capacity scores.
    "SH_IHR_CAPS": {"mean_over": "class_code"},
    # SDG 8.10.2 is adults aged 15 and over; 25+ and 15-24 are sub-bands,
    # and the quantile / education splits resolve to their _T totals.
    "FB_BNK_ACCSS": {"keep": {"age": "15+"}},
}

_GENERIC_TOTALS = (
    ("sex", "BOTHSEX"),
    ("location", "ALLAREA"),
    ("quantile", "_T"),
    ("education_level", "_T"),
    ("age", "ALLAGE"),
)

KEY = ["country_code", "year", "series_code"]


def series_total_columns(sdf: pd.DataFrame) -> list[tuple[str, str]]:
    """The (column, total) pairs for which this one series carries the total
    value somewhere. Shared with validation rule R11."""
    return [(col, total) for col, total in _GENERIC_TOTALS if col in sdf.columns and (sdf[col] == total).any()]


def select_dimensions(df: pd.DataFrame) -> pd.DataFrame:
    """Return the frame with at most one row per (country, year, series)
    wherever the rules can decide it. Rows that remain duplicated carry
    conflicting values and are the validator's job."""
    if df.empty or "series_code" not in df.columns:
        return df
    df = df.copy()
    out: list[pd.DataFrame] = []
    for series, sdf in df.groupby("series_code", dropna=False, sort=False):
        rule = SERIES_RULES.get(str(series), {})
        if "keep" in rule:
            for col, val in rule["keep"].items():
                if col in sdf.columns:
                    sdf = sdf[sdf[col] == val]
        if "mean_over" in rule:
            col = rule["mean_over"]
            if col in sdf.columns and sdf[col].notna().any():
                first = sdf.groupby(["country_code", "year"], dropna=False, sort=False).first()
                first["value"] = sdf.groupby(["country_code", "year"], dropna=False, sort=False)["value"].mean()
                first[col] = "MEAN"
                sdf = first.reset_index()
        for col, total in series_total_columns(sdf):
            sdf = sdf[(sdf[col] == total) | sdf[col].isna()]
        dup = sdf.duplicated(KEY, keep=False)
        if dup.any():
            pieces = [sdf[~dup]]
            for _, g in sdf[dup].groupby(["country_code", "year"], dropna=False, sort=False):
                if len(g) > 1 and g["value"].nunique(dropna=False) == 1:
                    g = g.iloc[[0]]
                pieces.append(g)
            sdf = pd.concat(pieces, ignore_index=True)
        out.append(sdf)
    return pd.concat(out, ignore_index=True) if out else df.iloc[0:0]


def conflicting_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    """Rows still duplicated on the key with more than one distinct value."""
    if df.empty:
        return df
    dup = df[df.duplicated(KEY, keep=False)]
    if dup.empty:
        return dup
    n = dup.groupby(KEY)["value"].nunique(dropna=False)
    bad = n[n > 1].index
    return dup.set_index(KEY).loc[bad].reset_index()
