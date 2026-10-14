from __future__ import annotations

import math

import numpy as np
import pandas as pd

from src.calculating.pillar_aggregate import BASKET_MIN_PRESENCE, basket_mean


def _wide(years, **cols):
    return pd.DataFrame(cols, index=pd.Index(years, name="year"))


def test_biennial_member_does_not_change_the_basket_year_to_year():
    years = list(range(1995, 2005))
    # a: every year. b: even years only until 2002, then every year.
    a = [50.0] * 10
    b = [20.0 if (y % 2 == 0 or y >= 2003) else np.nan for y in years]
    c = [30.0 if y >= 2003 else np.nan for y in years]
    out = basket_mean(_wide(years, a=a, b=b, c=c))
    assert out.loc[2004, "basket_size"] == 3
    # 3 members, need ceil(0.75*3)=3 present: odd years before 2003 are null
    assert math.isnan(out.loc[1997, "score"])
    assert math.isnan(out.loc[1996, "score"])  # only a and b present
    assert out.loc[2004, "score"] == (50 + 20 + 30) / 3


def test_member_outside_window_is_ignored_not_spiked():
    years = list(range(2010, 2020))
    a = [10.0] * 10
    stale = [90.0 if y == 2011 else np.nan for y in years]
    out = basket_mean(_wide(years, a=a, stale=stale))
    assert out.loc[2011, "basket_size"] == 1
    assert out.loc[2011, "score"] == 10.0


def test_presence_threshold_allows_one_laggard_in_a_basket_of_four():
    years = [2020, 2021]
    out = basket_mean(_wide(years, a=[1.0, 1.0], b=[1.0, 1.0], c=[1.0, 1.0], d=[1.0, np.nan]))
    assert out.loc[2021, "members_present"] == 3
    assert math.ceil(BASKET_MIN_PRESENCE * 4) == 3
    assert out.loc[2021, "score"] == 1.0


def test_empty_series_is_all_null():
    out = basket_mean(_wide([2000, 2001], a=[np.nan, np.nan]))
    assert out["score"].isna().all()
