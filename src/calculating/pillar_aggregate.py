"""
Aggregate per-indicator scores into per-subdomain and per-pillar scores for
the 7-pillar frontend taxonomy (`health, ag, si, women, climate, ctx, pri`).

Aggregation rule (generic, indicator-count-agnostic):

    subdomain_score(country, year, subdomain) = mean(indicator_score) over
                                                 indicators in that subdomain
                                                 that have a non-null value
                                                 for (country, year)

    pillar_score(country, year, pillar) = mean(subdomain_score) over
                                           subdomains in that pillar that
                                           have a non-null value for
                                           (country, year)

Single-indicator pillars (`women`, `climate`) pass through: the pillar score
equals the subdomain score which equals the indicator score.

Scores are emitted in the pipeline's native orientation (higher = more
vulnerable / greater need). The publish step applies `100 - x` before sending
JSON to the frontend. See
[indicators/SCORING_AUDIT.md](../../indicators/SCORING_AUDIT.md).
"""

from __future__ import annotations

import pandas as pd

from src.calculating.pillar_taxonomy import (
    series_code_to_pillar_subdomain,
    subdomain_to_pillar,
)


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


def compute_subdomain_scores(scored_df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate indicator scores to subdomain level via arithmetic mean over
    non-null indicator values.

    Input columns expected: `country_code, country_name, year, series_code, score`.
    Output columns: `country_code, country_name, year, pillar_key, subdomain_key,
    subdomain_score, indicator_count`.
    """
    df = _attach_pillar_subdomain(scored_df)
    df = df.dropna(subset=["pillar_key", "subdomain_key"])

    group_cols = [
        "country_code",
        "country_name",
        "year",
        "pillar_key",
        "subdomain_key",
    ]

    agg = (
        df.groupby(group_cols, dropna=False)["score"]
        .agg(
            subdomain_score=lambda s: float(s.dropna().mean())
            if s.notna().any()
            else float("nan"),
            indicator_count=lambda s: int(s.notna().sum()),
        )
        .reset_index()
    )
    return agg


def compute_pillar_scores(subdomain_scores: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate subdomain scores to pillar level via arithmetic mean over
    non-null subdomain values.

    Output columns: `country_code, country_name, year, pillar_key,
    pillar_score, subdomain_count`.
    """
    if subdomain_scores.empty:
        sub_to_pillar = subdomain_to_pillar()
        subdomain_scores = subdomain_scores.assign(
            pillar_key=subdomain_scores["subdomain_key"].map(sub_to_pillar)
            if "subdomain_key" in subdomain_scores
            else []
        )

    group_cols = ["country_code", "country_name", "year", "pillar_key"]

    agg = (
        subdomain_scores.groupby(group_cols, dropna=False)["subdomain_score"]
        .agg(
            pillar_score=lambda s: float(s.dropna().mean())
            if s.notna().any()
            else float("nan"),
            subdomain_count=lambda s: int(s.notna().sum()),
        )
        .reset_index()
    )
    return agg
