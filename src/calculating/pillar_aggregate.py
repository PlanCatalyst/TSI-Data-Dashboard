"""
Aggregate per-indicator scores into per-subdomain and per-pillar scores for
the 7-pillar frontend taxonomy (`health, ag, si, women, climate, ctx, pri`).

Aggregation rule: a basket mean (data quality issue DQ-03).

    basket(country, group) = members with at least one value in the last
                             BASKET_WINDOW_YEARS years of that country's series
    score(country, year)   = mean over basket members present that year,
                             only if present >= BASKET_MIN_PRESENCE of the
                             basket, else null

A plain "mean of whatever reported that year" changes composition from year
to year. Governance data is biennial before 2002, so the overall line used to
alternate between two different baskets and every country zigzagged from
1995 to 2002. Members outside the basket (an indicator with one value in
2011 and nothing since) are ignored rather than allowed to spike one year.

The same rule, same constants, is mirrored in the frontend
(`dashboard/src/data/contract/selectors.ts`, basketSeries) so the panel and
the publisher agree.

Scores are emitted in the pipeline's native orientation (higher = more need).
The publish step applies `100 - x`. See indicators/SCORING_AUDIT.md.
"""

from __future__ import annotations

import math

import pandas as pd

from src.calculating.pillar_taxonomy import (
    series_code_to_pillar_subdomain,
    subdomain_to_pillar,
)

BASKET_WINDOW_YEARS = 5
BASKET_MIN_PRESENCE = 0.75


def _attach_pillar_subdomain(scored_df: pd.DataFrame) -> pd.DataFrame:
    """Annotate scored indicator rows with their pillar + subdomain keys."""
    mapping = series_code_to_pillar_subdomain()
    if not mapping:
        return scored_df.assign(pillar_key=pd.NA, subdomain_key=pd.NA)

    lookup = pd.DataFrame.from_records(
        [
            {"series_code": sc, "pillar_key": pk, "subdomain_key": sd}
            for sc, (pk, sd) in mapping.items()
        ]
    ).set_index("series_code")

    return scored_df.join(lookup, on="series_code", how="left")


def basket_mean(wide: pd.DataFrame) -> pd.DataFrame:
    """wide: index = year (int), columns = members, values = score or NaN.
    Returns a frame indexed by year with score, basket_size, members_present."""
    empty = pd.DataFrame(columns=["score", "basket_size", "members_present"], index=wide.index)
    if wide.empty:
        return empty
    any_present = wide.notna().any(axis=1)
    if not any_present.any():
        empty["score"] = float("nan")
        empty["basket_size"] = 0
        empty["members_present"] = 0
        return empty
    last = int(wide.index[any_present].max())
    window = wide.loc[(wide.index > last - BASKET_WINDOW_YEARS) & (wide.index <= last)]
    basket = [c for c in wide.columns if window[c].notna().any()]
    need = max(1, math.ceil(BASKET_MIN_PRESENCE * len(basket)))
    sub = wide[basket]
    present = sub.notna().sum(axis=1)
    score = sub.mean(axis=1).where(present >= need)
    return pd.DataFrame(
        {"score": score.astype(float), "basket_size": len(basket), "members_present": present.astype(int)},
        index=wide.index,
    )


def _aggregate(df: pd.DataFrame, group_cols: list[str], member_col: str, value_col: str, out_col: str, count_col: str) -> pd.DataFrame:
    rows = []
    for keys, g in df.groupby(group_cols, dropna=False, sort=True):
        wide = g.pivot_table(index="year", columns=member_col, values=value_col, aggfunc="first")
        wide.index = wide.index.astype(int)
        res = basket_mean(wide)
        base = dict(zip(group_cols, keys if isinstance(keys, tuple) else (keys,)))
        for year, r in res.iterrows():
            rows.append({**base, "year": int(year), out_col: r["score"], count_col: int(r["members_present"]), "basket_size": int(r["basket_size"])})
    cols = [*group_cols, "year", out_col, count_col, "basket_size"]
    return pd.DataFrame(rows, columns=cols)


def compute_subdomain_scores(scored_df: pd.DataFrame) -> pd.DataFrame:
    """
    Basket mean of indicator scores per subdomain.

    Input columns expected: `country_code, country_name, year, series_code, score`.
    Output columns: `country_code, country_name, year, pillar_key, subdomain_key,
    subdomain_score, indicator_count, basket_size`.
    """
    df = _attach_pillar_subdomain(scored_df)
    df = df.dropna(subset=["pillar_key", "subdomain_key"])
    group_cols = ["country_code", "country_name", "pillar_key", "subdomain_key"]
    out = _aggregate(df, group_cols, "series_code", "score", "subdomain_score", "indicator_count")
    return out[["country_code", "country_name", "year", "pillar_key", "subdomain_key", "subdomain_score", "indicator_count", "basket_size"]]


def compute_pillar_scores(subdomain_scores: pd.DataFrame) -> pd.DataFrame:
    """
    Basket mean of subdomain scores per pillar.

    Output columns: `country_code, country_name, year, pillar_key,
    pillar_score, subdomain_count, basket_size`.
    """
    if subdomain_scores.empty:
        return pd.DataFrame(columns=["country_code", "country_name", "year", "pillar_key", "pillar_score", "subdomain_count", "basket_size"])
    if "pillar_key" not in subdomain_scores.columns:
        subdomain_scores = subdomain_scores.assign(pillar_key=subdomain_scores["subdomain_key"].map(subdomain_to_pillar()))
    group_cols = ["country_code", "country_name", "pillar_key"]
    out = _aggregate(subdomain_scores, group_cols, "subdomain_key", "subdomain_score", "pillar_score", "subdomain_count")
    return out[["country_code", "country_name", "year", "pillar_key", "pillar_score", "subdomain_count", "basket_size"]]
