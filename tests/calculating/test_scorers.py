from __future__ import annotations

import pandas as pd
import pytest

from src.calculating.factory import IndicatorScorerFactory
from src.calculating.scorers import (
    SOFT_FLOOR_BAND,
    GoalRatioScorer,
    InverseRatioScorer,
    RatioThresholdScorer,
    RelativeGainScorer,
)


def _df(values):
    return pd.DataFrame({"value": values})


# Brazil, climate: ND-GAIN vulnerability 0.37 to 0.41 against the 0.46
# benchmark. The clamp pins every year to 0 need (100 on the dashboard).
BRAZIL = [0.37, 0.38, 0.39, 0.40, 0.41]
BENCHMARK = 0.46


def test_clamp_pins_better_than_benchmark_to_zero():
    scorer = RatioThresholdScorer(threshold=BENCHMARK)
    out = scorer.score(_df(BRAZIL + [0.46, 0.6, 0.9]))
    assert (out.iloc[:5] == 0.0).all()
    assert out.iloc[5] == 0.0
    assert out.iloc[6] > 0.0


def test_soft_floor_restores_variation_below_benchmark():
    scorer = RatioThresholdScorer(threshold=BENCHMARK, below_benchmark="soft_floor")
    out = scorer.score(_df(BRAZIL + [0.46, 0.6, 0.9]))
    below = out.iloc[:5]
    # strictly increasing need as vulnerability rises toward the benchmark
    assert (below.diff().dropna() > 0).all()
    assert below.iloc[0] == 0.0  # best observed value anchors the band
    assert (below <= SOFT_FLOOR_BAND).all()
    # the benchmark itself is the midpoint of the band boundary
    assert out.iloc[5] == pytest.approx(SOFT_FLOOR_BAND)
    # worse than benchmark stays above the band and keeps its ordering
    assert out.iloc[6] > SOFT_FLOOR_BAND
    assert out.iloc[7] > out.iloc[6]
    assert out.max() <= 100.0


def test_soft_floor_keeps_nulls_null():
    scorer = RatioThresholdScorer(threshold=BENCHMARK, below_benchmark="soft_floor")
    out = scorer.score(_df([0.40, None, 0.60]))
    assert pd.isna(out.iloc[1])


def test_inverse_ratio_soft_floor_below_benchmark_gap():
    # value is a coverage percentage; gap = 100 - value; benchmark gap 27.1
    scorer = InverseRatioScorer(global_avg_val=27.1, below_benchmark="soft_floor")
    out = scorer.score(_df([99.0, 90.0, 80.0, 72.9, 50.0]))
    assert (out.iloc[:3].diff().dropna() > 0).all()
    assert out.iloc[3] == pytest.approx(SOFT_FLOOR_BAND, abs=1e-6)
    assert out.iloc[4] > SOFT_FLOOR_BAND


def test_goal_ratio_soft_floor_beyond_goal():
    scorer = GoalRatioScorer(goal=0.02, below_benchmark="soft_floor")
    out = scorer.score(_df([0.05, 0.03, 0.02, 0.01]))
    assert out.iloc[0] == 0.0
    assert out.iloc[0] < out.iloc[1] < out.iloc[2]
    assert out.iloc[2] == pytest.approx(SOFT_FLOOR_BAND)
    assert out.iloc[3] > SOFT_FLOOR_BAND


def test_factory_default_is_clamp_and_rejects_unknown_mode():
    assert IndicatorScorerFactory().for_series("ND_GAIN_VULN").below_benchmark == "clamp"
    assert IndicatorScorerFactory("soft_floor").for_series("ND_GAIN_VULN").below_benchmark == "soft_floor"
    with pytest.raises(ValueError):
        IndicatorScorerFactory("minmax")


def test_inverse_ratio_missing_value_stays_missing():
    # DQ-06: NaN compared False against the benchmark and became need 0.
    out = InverseRatioScorer(global_avg_val=27.1).score(_df([None, 50.0]))
    assert pd.isna(out.iloc[0])
    assert out.iloc[1] > 0


def test_ratio_threshold_missing_value_stays_missing():
    out = RatioThresholdScorer(threshold=25.0, global_average=25.0).score(_df([None, 10.0, 80.0]))
    assert pd.isna(out.iloc[0]) and out.iloc[1] == 0.0 and out.iloc[2] > 0


# 7.2.1 and 3.7.1 (framework clarified 2026-10-16): 1 - benchmark / value,
# below the benchmark harmonizes to 0, best value = 100, no inversion. The
# scorer returns need, so the dashboard shows 100 - need.
def _shown(need):
    return 100.0 - need


def test_relative_gain_renewables_goal_is_a_floor():
    out = RelativeGainScorer(benchmark=20.0).score(_df([5.0, 19.9, 20.0, 40.0, 80.0]))
    shown = _shown(out)
    assert (shown.iloc[:3] == 0.0).all()  # below and at the 20% goal
    assert shown.iloc[4] == pytest.approx(100.0)  # best value anchors 100
    # 40% share: (1 - 20/40) / (1 - 20/80) = 0.5 / 0.75
    assert shown.iloc[3] == pytest.approx(100.0 * 0.5 / 0.75)


def test_relative_gain_family_planning_global_average():
    out = RelativeGainScorer(benchmark=77.2).score(_df([60.0, 77.2, 85.0, 96.6]))
    shown = _shown(out)
    assert shown.iloc[0] == 0.0 and shown.iloc[1] == 0.0
    assert 0.0 < shown.iloc[2] < shown.iloc[3] == pytest.approx(100.0)


def test_relative_gain_keeps_nulls_and_survives_zero():
    out = RelativeGainScorer(benchmark=20.0).score(_df([None, 0.0, 50.0]))
    assert pd.isna(out.iloc[0])
    assert _shown(out).iloc[1] == 0.0
    assert _shown(out).iloc[2] == pytest.approx(100.0)


def test_relative_gain_all_below_benchmark_scores_zero():
    out = RelativeGainScorer(benchmark=77.2).score(_df([50.0, 70.0]))
    assert (_shown(out) == 0.0).all()


def test_factory_uses_relative_gain_for_renewables_and_family_planning():
    f = IndicatorScorerFactory()
    assert f.for_series("EG_FEC_RNEW").benchmark == 20.0
    assert f.for_series("SH_FPL_MTMM").benchmark == 77.2
    assert isinstance(f.for_series("EG_FEC_RNEW"), RelativeGainScorer)
