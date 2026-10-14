"""Data quality rules, one per class of defect seen on the dashboard.

Each rule returns Findings. Severity "block" fails the pipeline before
publish; "warn" is reported and counted. Every rule names the issue-log entry
it exists for (docs/data-quality-issues.md) so a new bug means a new DQ entry
and, where it can be caught in data, a new rule here.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from typing import Callable, Iterable

import numpy as np
import pandas as pd

from src.calculating.dimensions import conflicting_duplicates
from src.calculating.pillar_aggregate import BASKET_MIN_PRESENCE


@dataclass
class Finding:
    rule: str
    severity: str          # "block" | "warn"
    issue: str             # DQ-xx
    series: str | None
    country: str | None
    detail: str
    count: int = 1

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class Inputs:
    scored: pd.DataFrame            # Indicator_Scores_Full.csv
    pillars: pd.DataFrame           # pillarscores.csv
    subdomains: pd.DataFrame        # subdomainscores.csv
    options: dict = field(default_factory=dict)


Rule = Callable[[Inputs], Iterable[Finding]]

ALTERNATION_JUMP = 25.0
ALTERNATION_MIN = 3
FLAT_RUN_YEARS = 10
PINNED_SHARE_WARN = 0.5


def r1_unique_country_year_series(x: Inputs):
    bad = conflicting_duplicates(x.scored)
    for (series, iso), g in bad.groupby(["series_code", "country_code"]):
        yield Finding("R1", "block", "DQ-02", series, iso,
                      f"{len(g)} rows with conflicting values for the same year; add a rule in src/calculating/dimensions.py",
                      count=len(g))


def r2_score_shape(x: Inputs):
    s = x.scored
    out_of_range = s[s["score"].notna() & ((s["score"] < 0) | (s["score"] > 100))]
    for series, g in out_of_range.groupby("series_code"):
        yield Finding("R2", "block", "DQ-06", series, None, f"{len(g)} scores outside 0 to 100", count=len(g))
    ghost = s[s["value"].isna() & s["score"].notna()]
    for series, g in ghost.groupby("series_code"):
        yield Finding("R2", "block", "DQ-06", series, None, f"{len(g)} scores with no source value", count=len(g))


def _alternations(values: np.ndarray) -> int:
    d = np.diff(values)
    big = np.abs(d) >= ALTERNATION_JUMP
    flips = (d[:-1] * d[1:]) < 0
    return int(np.sum(flips & big[:-1] & big[1:]))


ALTERNATION_SYSTEMIC_COUNTRIES = 3


def r3_alternating_series(x: Inputs):
    """A sawtooth in several countries of one series is a processing defect
    (DQ-02) and blocks. A sawtooth in one country only is usually real
    small-population noise (DQ-09) and warns."""
    s = x.scored.dropna(subset=["score"]).sort_values(["series_code", "country_code", "year"])
    hits: dict[str, list[tuple[str, int]]] = {}
    for (series, iso), g in s.groupby(["series_code", "country_code"]):
        if len(g) < 6:
            continue
        n = _alternations(g["score"].to_numpy(dtype=float))
        if n >= ALTERNATION_MIN:
            hits.setdefault(str(series), []).append((str(iso), n))
    for series, countries in hits.items():
        systemic = len(countries) >= ALTERNATION_SYSTEMIC_COUNTRIES and series not in x.options.get("lumpy_series", ())
        for iso, n in countries:
            yield Finding("R3", "block" if systemic else "warn", "DQ-02" if systemic else "DQ-09", series, iso,
                          f"{n} sign-alternating jumps of {ALTERNATION_JUMP:.0f}+ points; "
                          + ("sawtooth in several countries" if systemic else "sawtooth in this country only"))


def r4_flat_runs(x: Inputs):
    s = x.scored.dropna(subset=["score"]).sort_values(["series_code", "country_code", "year"])
    for (series, iso), g in s.groupby(["series_code", "country_code"]):
        scores = g["score"].to_numpy(); values = g["value"].to_numpy()
        start = 0
        for i in range(1, len(scores) + 1):
            if i == len(scores) or scores[i] != scores[start]:
                if i - start >= FLAT_RUN_YEARS and len(set(values[start:i])) > 1:
                    yield Finding("R4", "warn", "DQ-01", series, iso,
                                  f"score unchanged for {i - start} years while the source value moves")
                    break
                start = i


def r5_pinned_share(x: Inputs):
    s = x.scored.dropna(subset=["value"])
    if "floored_to_zero" not in s.columns:
        return
    for series, g in s.groupby("series_code"):
        share = float(g["floored_to_zero"].mean()) if len(g) else 0.0
        if share > PINNED_SHARE_WARN:
            yield Finding("R5", "warn", "DQ-01", series, None,
                          f"{share:.0%} of country-years pinned at the benchmark floor", count=int(g["floored_to_zero"].sum()))


def r6_basket_presence(x: Inputs):
    for name, df, col in (("subdomain", x.subdomains, "indicator_count"), ("pillar", x.pillars, "subdomain_count")):
        if df.empty or "basket_size" not in df.columns:
            yield Finding("R6", "block", "DQ-03", None, None, f"{name} scores lack basket columns; aggregation did not run the basket rule")
            continue
        scored = df.dropna(subset=[f"{name}_score"])
        need = np.ceil(BASKET_MIN_PRESENCE * scored["basket_size"]).clip(lower=1)
        bad = scored[scored[col] < need]
        if len(bad):
            yield Finding("R6", "block", "DQ-03", None, None,
                          f"{len(bad)} {name}-years scored with fewer members than the basket rule allows", count=len(bad))


def r7_single_member_pillar(x: Inputs):
    p = x.pillars.dropna(subset=["pillar_score"]) if not x.pillars.empty else x.pillars
    if p.empty or "basket_size" not in p.columns:
        return
    thin = p[(p["basket_size"] >= 3) & (p["subdomain_count"] == 1)]
    for pillar, g in thin.groupby("pillar_key"):
        yield Finding("R7", "warn", "DQ-05", str(pillar), None,
                      f"{len(g)} pillar-years rest on one of {int(g['basket_size'].max())} subdomains", count=len(g))


def r8_country_identity(x: Inputs):
    codes = x.scored["country_code"].dropna().astype(str)
    bad = codes[~codes.str.fullmatch(r"[A-Z]{3}")].unique()
    if len(bad):
        yield Finding("R8", "block", "DQ-07", None, None, f"{len(bad)} country codes are not ISO3: {', '.join(map(str, bad[:5]))}", count=len(bad))


def r9_year_sanity(x: Inputs):
    y = pd.to_numeric(x.scored["year"], errors="coerce")
    bad = x.scored[y.isna() | (y < 1960) | (y > 2100)]
    if len(bad):
        yield Finding("R9", "block", "DQ-07", None, None, f"{len(bad)} rows with an impossible year", count=len(bad))


RULES: list[Rule] = [
    r1_unique_country_year_series,
    r2_score_shape,
    r3_alternating_series,
    r4_flat_runs,
    r5_pinned_share,
    r6_basket_presence,
    r7_single_member_pillar,
    r8_country_identity,
    r9_year_sanity,
]
