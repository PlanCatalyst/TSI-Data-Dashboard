from __future__ import annotations

from typing import Literal, Optional

import numpy as np
import pandas as pd

from src.calculating.base import IndicatorScorer

# How a value that is already better than the client's benchmark is scored.
#   clamp      : v1 behaviour. Need floors at 0, so every better-than-benchmark
#                country shows the same top score and no trend (requirements
#                v2, section 1.2).
#   soft_floor : option B. The benchmark maps to need 25; values better than
#                it spread linearly over [0, 25) down to the best observed
#                value in the batch; values worse than it spread over [25, 100]
#                with the original ratio formula. Ordering is preserved and
#                trends below the benchmark become visible.
# The active mode is a pipeline setting (settings.yaml scoring.below_benchmark)
# so the client's decision is a config flip plus an index_version bump.
BelowBenchmark = Literal["clamp", "soft_floor"]
SOFT_FLOOR_BAND = 25.0


def soft_floor_scores(
    raw_need: pd.Series,
    distance_below: pd.Series,
    below_mask: pd.Series,
) -> pd.Series:
    """Combine the above-benchmark ratio score with a lower band for values
    better than the benchmark.

    raw_need       : the v1 formula result in [0, 100] for every row (NaN kept).
    distance_below : how far each row is beyond the benchmark, in the
                     indicator's own units, positive = better than benchmark.
    below_mask     : True where the row is better than the benchmark.
    """
    above = SOFT_FLOOR_BAND + (100.0 - SOFT_FLOOR_BAND) * (raw_need.clip(0.0, 100.0) / 100.0)
    best = distance_below.where(below_mask).max()
    if pd.isna(best) or best <= 0:
        below = pd.Series(SOFT_FLOOR_BAND, index=raw_need.index)
    else:
        below = SOFT_FLOOR_BAND * (1.0 - distance_below / best)
    out = above.where(~below_mask, other=below)
    return out.clip(0.0, 100.0).where(raw_need.notna())


class SimpleDirectionalScorer(IndicatorScorer):
    """Score = 100 - value (the “gap” or “need”), clamped to [0, 100]."""

    def score(self, df: pd.DataFrame) -> pd.Series:
        return self.clamp_0_100(100.0 - df["value"].astype(float))


class RatioThresholdScorer(IndicatorScorer):
    """
    Standard logic used for many “lower is better” indicators:

        score_raw = 1 - (threshold / value)
        score = clamp_0_100(score_raw * 100)

    Optionally harmonizes to 0 when the country is better than a
    specified global-average value.
    """

    def __init__(
        self,
        threshold: float,
        global_average: Optional[float] = None,
        below_benchmark: BelowBenchmark = "clamp",
    ):
        self.threshold = float(threshold)
        self.global_average = (
            float(global_average) if global_average is not None else None
        )
        self.below_benchmark = below_benchmark

    def score(self, df: pd.DataFrame) -> pd.Series:
        values = df["value"].astype(float)
        with np.errstate(divide="ignore", invalid="ignore"):
            raw = 1.0 - (self.threshold / values)
        scores = self.clamp_0_100(raw * 100.0)

        if self.below_benchmark == "soft_floor":
            below = values < self.threshold
            return soft_floor_scores(scores, self.threshold - values, below)

        # If a global average is provided, harmonize: values better than the
        # global average (directionality implied by threshold) are set to 0.
        if self.global_average is not None:
            mask = values < self.global_average
            scores = scores.where(~mask, other=0.0)

        return scores


class InverseRatioScorer(IndicatorScorer):
    """
    Two-step logic used for some “gap” indicators (e.g., water, finance):

        gap_country = 100 - value
        gap_global  = 100 - global_avg_val
        score_raw   = 1 - (gap_global / gap_country)
        score       = clamp_0_100(score_raw * 100)

    Harmonizes to 0 if the country gap is smaller (better) than the
    global-average gap.
    """

    def __init__(self, global_avg_val: float, below_benchmark: BelowBenchmark = "clamp"):
        # Client framework provides the benchmark as the *gap* directly.
        self.threshold_gap = float(global_avg_val)
        self.below_benchmark = below_benchmark

    def score(self, df: pd.DataFrame) -> pd.Series:
        country_gap = 100.0 - df["value"].astype(float)
        with np.errstate(divide="ignore", invalid="ignore"):
            raw = 1.0 - (self.threshold_gap / country_gap)
        scores = self.clamp_0_100(raw * 100.0)
        if self.below_benchmark == "soft_floor":
            below = country_gap < self.threshold_gap
            return soft_floor_scores(scores, self.threshold_gap - country_gap, below)
        # A missing value compares False against the benchmark; without the
        # isna() guard it became need 0, which the dashboard showed as 100
        # (data quality issue DQ-06, 93 country-years in the 2026-07 snapshot).
        better = country_gap < self.threshold_gap
        scores = scores.where(~better | country_gap.isna(), other=0.0)
        return scores


class RatioGoalInverseScorer(IndicatorScorer):
    """
    Logic for 2.4.1 (sustainable agriculture):

        transformed = 1 / value^2
        score_raw   = 1 - (goal_transformed / transformed)
        score       = clamp_0_100(score_raw * 100)
    """

    def __init__(self, goal_transformed: float = 0.04):
        self.goal = float(goal_transformed)

    def score(self, df: pd.DataFrame) -> pd.Series:
        values = df["value"].astype(float)
        transformed = 1.0 / np.square(values)
        with np.errstate(divide="ignore", invalid="ignore"):
            raw = 1.0 - (self.goal / transformed)
        scores = self.clamp_0_100(raw * 100.0)
        return scores


class GoalRatioScorer(IndicatorScorer):
    """
    Logic for indicators with an explicit goal as a ratio (e.g., DC_TOF_AGRL):

        score_raw = 1 - (value / goal)
        score     = clamp_0_100(score_raw * 100)
    """

    def __init__(
        self,
        goal: float,
        global_average: Optional[float] = None,
        below_benchmark: BelowBenchmark = "clamp",
    ):
        self.goal = float(goal)
        self.global_average = (
            float(global_average) if global_average is not None else None
        )
        self.below_benchmark = below_benchmark

    def score(self, df: pd.DataFrame) -> pd.Series:
        values = df["value"].astype(float)
        with np.errstate(divide="ignore", invalid="ignore"):
            raw = 1.0 - (values / self.goal)
        scores = self.clamp_0_100(raw * 100.0)

        if self.below_benchmark == "soft_floor":
            below = values > self.goal
            return soft_floor_scores(scores, values - self.goal, below)

        if self.global_average is not None:
            mask = values > self.global_average
            scores = scores.where(~mask, other=0.0)

        return scores


class InverseIndexScorer(IndicatorScorer):
    """
    Scorer for a normalized 0-1 index where higher = better (e.g. HDI).

        score = (1 - value) * 100

    Flips a development/wellbeing index into the pipeline's vulnerability
    orientation: a high-development country (HDI ~0.95) scores ~5 (low need),
    a low-development country (HDI ~0.40) scores ~60 (high need). No benchmark
    harmonization — the index is already globally normalized.
    """

    def score(self, df: pd.DataFrame) -> pd.Series:
        return self.clamp_0_100((1.0 - df["value"].astype(float)) * 100.0)


class DensityScorer(IndicatorScorer):
    """
    Banded scoring for population density (people per sq. km), matching the
    canonical formula in indicators.yaml. Vulnerability orientation: denser =
    higher "need" score (inverted to higher-is-better at the publish boundary).

        >=250          -> 100
        >=100 and <250 ->  75
        >=75  and <100 ->  50
        >=25  and <75  ->  25
        <25            ->   0

    Missing values (NaN) are preserved as NaN so they publish as JSON null.
    (Replaced the prior continuous `(value/0.7)*100`, which saturated ~99.6%
    of countries to the bound and produced a near-constant score. See
    indicators/SCORING_AUDIT.md row 27.)
    """

    def score(self, df: pd.DataFrame) -> pd.Series:
        v = df["value"].astype(float)
        scores = np.select(
            [v >= 250, v >= 100, v >= 75, v >= 25],
            [100.0, 75.0, 50.0, 25.0],
            default=0.0,
        )
        scores = pd.Series(scores, index=v.index, dtype=float)
        scores[v.isna()] = np.nan
        return self.clamp_0_100(scores)
