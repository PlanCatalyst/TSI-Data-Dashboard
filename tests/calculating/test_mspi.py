from __future__ import annotations

import math

import pandas as pd
import pytest

from src.calculating.factory import IndicatorScorerFactory
from src.calculating.mspi import (
    INCOME_SERIES,
    MSPI_SERIES_CODE,
    WGI_EST_SERIES,
    append_mspi_rows,
    avg_wgi,
    compose_mspi_component_rows,
    compose_mspi_rows,
    debt_stock_basis,
    debt_tier,
    norm_debt_risk,
    norm_income,
    norm_nonconcessional,
)
from src.calculating.pillar_taxonomy import NON_SDG_FRONTEND_KEY_TO_SERIES_CODE


def _row(code: str, year: int, series: str, value, country: str = "KEN") -> dict:
    return {
        "country_code": code,
        "country_name": "Kenya" if code == "KEN" else code,
        "year": year,
        "value": value,
        "indicator": series,
        "series_code": series,
    }


def _complete_components(*, gdp=10000, wgi=0.0, pv_gni=20, pv_exp=80, ds=8, conces=70) -> pd.DataFrame:
    rows = [
        _row("KEN", 2020, INCOME_SERIES, gdp),
        _row("KEN", 2020, "DT.DOD.ALLC.ZS", conces),
        _row("KEN", 2020, "DT.DOD.PVLX.GN.ZS", pv_gni),
        _row("KEN", 2020, "DT.DOD.PVLX.EX.ZS", pv_exp),
        _row("KEN", 2020, "DT.TDS.DECT.EX.ZS", ds),
    ]
    for series in WGI_EST_SERIES:
        rows.append(_row("KEN", 2020, series, wgi))
    return pd.DataFrame(rows)


def test_norm_income_bounds():
    s = pd.Series([200.0, 150_000.0, 50.0, 1_000_000.0, 0.0, None])
    out = norm_income(s)
    assert out.iloc[0] == pytest.approx(0.0)
    assert out.iloc[1] == pytest.approx(1.0)
    assert out.iloc[2] == pytest.approx(0.0)  # clipped
    assert out.iloc[3] == pytest.approx(1.0)  # clipped
    assert pd.isna(out.iloc[4])
    assert pd.isna(out.iloc[5])
    mid = math.exp(0.5 * (math.log(200) + math.log(150_000)))
    assert norm_income(pd.Series([mid])).iloc[0] == pytest.approx(0.5)


def test_avg_wgi_skips_missing():
    est = pd.DataFrame(
        {
            "VA.EST": [1.0, None],
            "PV.EST": [None, None],
            "GE.EST": [-1.0, None],
            "RQ.EST": [None, None],
            "RL.EST": [None, None],
            "CC.EST": [None, None],
        }
    )
    avg = avg_wgi(est)
    assert avg.iloc[0] == pytest.approx(0.0)
    assert pd.isna(avg.iloc[1])


def test_debt_tier_cutoffs():
    avg = pd.Series([-0.20, -0.21, -0.80, -0.81, None])
    tier = debt_tier(avg)
    assert list(tier.iloc[:4]) == ["strong", "medium", "medium", "weak"]
    assert pd.isna(tier.iloc[4])


def test_pv_preferred_over_face_value():
    v_gni, v_exp, basis = debt_stock_basis(
        pd.Series([10.0, None, None]),
        pd.Series([20.0, None, 99.0]),
        pd.Series([30.0, 40.0, 50.0]),
        pd.Series([60.0, 70.0, 80.0]),
    )
    assert basis.iloc[0] == "present_value"
    assert (v_gni.iloc[0], v_exp.iloc[0]) == (10.0, 20.0)
    assert basis.iloc[1] == "face_value"
    assert (v_gni.iloc[1], v_exp.iloc[1]) == (40.0, 70.0)
    # one PV series is not enough, so it falls back rather than mixing bases
    assert basis.iloc[2] == "face_value"
    assert (v_gni.iloc[2], v_exp.iloc[2]) == (50.0, 80.0)


def test_debt_risk_bins_and_worst_ratio():
    # strong thresholds: gdp 55, exports 240, ds 21
    # ratio 0.74 -> Low (1.0); 0.75 -> Moderate; 1.0 -> High. All three ratios
    # present and well below their own thresholds, so the gdp ratio is the
    # binding (worst) one in every row.
    tier = pd.Series(["strong", "strong", "strong"])
    n = norm_debt_risk(
        tier,
        pd.Series([55 * 0.74, 55 * 0.75, 55.0]),
        pd.Series([1.0, 1.0, 1.0]),
        pd.Series([1.0, 1.0, 1.0]),
    )
    assert list(n) == [1.0, 0.5, 0.0]


def test_debt_risk_null_when_any_one_ratio_is_missing():
    """Decided 2026-11-03: all three ratios required, no partial score."""
    tier = pd.Series(["strong", "strong", "strong", "strong"])
    n = norm_debt_risk(
        tier,
        pd.Series([55 * 0.1, None, 55 * 0.1, 55 * 0.1]),
        pd.Series([240 * 0.1, 240 * 0.1, None, 240 * 0.1]),
        pd.Series([21 * 0.1, 21 * 0.1, 21 * 0.1, None]),
    )
    assert n.iloc[0] == 1.0
    assert pd.isna(n.iloc[1])
    assert pd.isna(n.iloc[2])
    assert pd.isna(n.iloc[3])


def test_all_or_nothing_null_if_concessional_missing():
    df = _complete_components()
    df = df[df["series_code"] != "DT.DOD.ALLC.ZS"]
    assert compose_mspi_rows(df).empty


def test_missing_wgi_does_not_crash_and_emits_nothing():
    df = _complete_components()
    df = df[~df["series_code"].isin(WGI_EST_SERIES)]
    assert compose_mspi_rows(df).empty


def test_weighted_sum_and_pipeline_invert():
    # gdp at midpoint → 0.5 income
    mid = math.exp(0.5 * (math.log(200) + math.log(150_000)))
    # avg_wgi 0 → fragility 0.5; strong tier; all debt ratios Low → 1.0
    # conces 100% → nonconcessional 1.0
    df = _complete_components(gdp=mid, wgi=0.0, pv_gni=1.0, pv_exp=1.0, ds=1.0, conces=100.0)
    composed = compose_mspi_rows(df)
    assert len(composed) == 1
    # 100 * (0.25*0.5 + 0.25*0.5 + 0.25*1.0 + 0.25*1.0) = 75
    assert composed.iloc[0]["value"] == pytest.approx(75.0)
    assert composed.iloc[0]["series_code"] == MSPI_SERIES_CODE
    assert composed.iloc[0]["debt_basis"] == "present_value"

    work = append_mspi_rows(df)
    factory = IndicatorScorerFactory()
    mspi = work[work["series_code"] == MSPI_SERIES_CODE]
    pipeline_score = factory.for_series(MSPI_SERIES_CODE).score(mspi).iloc[0]
    assert pipeline_score == pytest.approx(25.0)  # 100 - 75


def test_taxonomy_and_factory_point_at_mspi():
    assert NON_SDG_FRONTEND_KEY_TO_SERIES_CODE["mspi"] == MSPI_SERIES_CODE
    assert MSPI_SERIES_CODE in IndicatorScorerFactory()._scorers
    for key, code in (
        ("mspi_inc", "MSPI_INC"),
        ("mspi_frag", "MSPI_FRAG"),
        ("mspi_debt", "MSPI_DEBT"),
        ("mspi_conc", "MSPI_CONC"),
    ):
        assert NON_SDG_FRONTEND_KEY_TO_SERIES_CODE[key] == code
        assert code in IndicatorScorerFactory()._scorers


def test_component_rows_scale_to_0_100_and_skip_missing_inputs():
    mid = math.exp(0.5 * (math.log(200) + math.log(150_000)))
    df = _complete_components(gdp=mid, wgi=0.0, pv_gni=1.0, pv_exp=1.0, ds=1.0, conces=100.0)
    rows = compose_mspi_component_rows(df)
    by_code = {r["series_code"]: r["value"] for _, r in rows.iterrows()}
    assert by_code["MSPI_INC"] == pytest.approx(50.0)
    assert by_code["MSPI_FRAG"] == pytest.approx(50.0)
    assert by_code["MSPI_DEBT"] == pytest.approx(100.0)
    assert by_code["MSPI_CONC"] == pytest.approx(100.0)

    # Drop concessionality: the other three components still publish, but
    # MSPI_CONC does not, and the composite (which needs all four) is empty.
    partial = df[df["series_code"] != "DT.DOD.ALLC.ZS"]
    assert compose_mspi_rows(partial).empty
    partial_rows = compose_mspi_component_rows(partial)
    assert set(partial_rows["series_code"]) == {"MSPI_INC", "MSPI_FRAG", "MSPI_DEBT"}


def test_append_mspi_rows_includes_components():
    df = _complete_components()
    work = append_mspi_rows(df)
    for code in ("MSPI_INDEX", "MSPI_INC", "MSPI_FRAG", "MSPI_DEBT", "MSPI_CONC"):
        assert (work["series_code"] == code).any()


def test_norm_nonconcessional_inverts_share():
    # 70% concessional → raw 30 → norm 0.7
    assert norm_nonconcessional(pd.Series([70.0])).iloc[0] == pytest.approx(0.7)
    assert norm_nonconcessional(pd.Series([100.0])).iloc[0] == pytest.approx(1.0)
    assert norm_nonconcessional(pd.Series([0.0])).iloc[0] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Country-level status (contract §3.1)
# ---------------------------------------------------------------------------


def _metadata(**scope: bool) -> pd.DataFrame:
    return pd.DataFrame(
        [{"country_code": code, "ids_in_scope": flag} for code, flag in scope.items()]
    )


def _status_map(df: pd.DataFrame) -> dict[str, tuple[str, str]]:
    return {r.country_code: (r.status, r.missing_components) for r in df.itertuples()}


def test_status_scored_when_any_year_complete():
    from src.calculating.mspi import mspi_country_status

    out = mspi_country_status(_complete_components(), _metadata(KEN=True))
    assert list(out.columns) == ["country_code", "indicator_key", "status", "missing_components"]
    assert _status_map(out) == {"KEN": ("scored", "")}
    assert set(out["indicator_key"]) == {"mspi"}


def test_status_incomplete_lists_missing_components_from_latest_year():
    from src.calculating.mspi import mspi_country_status

    df = _complete_components()
    df = df[df["series_code"] != "DT.DOD.ALLC.ZS"]
    out = mspi_country_status(df, _metadata(KEN=True))
    assert _status_map(out) == {"KEN": ("incomplete_data", "concessionality")}


def test_status_in_scope_by_lending_type_but_no_ids_history_is_out_of_scope():
    """Scope refinement 2026-09-29: no IDS observation in any year = out of scope."""
    from src.calculating.mspi import mspi_country_status

    # No data at all.
    out = mspi_country_status(pd.DataFrame(columns=["country_code", "year", "value", "series_code"]), _metadata(POL=True))
    assert _status_map(out) == {"POL": ("out_of_scope", "")}

    # Income and governance present, but every IDS series absent (a graduate).
    df = _complete_components()
    df = df[~df["series_code"].str.startswith("DT.")]
    out = mspi_country_status(df, _metadata(KEN=True))
    assert _status_map(out) == {"KEN": ("out_of_scope", "")}


def test_status_incomplete_when_some_ids_history_exists():
    """One IDS observation keeps a country in scope; the gap is then named."""
    from src.calculating.mspi import mspi_country_status

    df = _complete_components()
    # Keep concessionality, drop the debt-stock and service series.
    df = df[~df["series_code"].isin(["DT.DOD.PVLX.GN.ZS", "DT.DOD.PVLX.EX.ZS", "DT.TDS.DECT.EX.ZS"])]
    out = mspi_country_status(df, _metadata(KEN=True))
    assert _status_map(out) == {"KEN": ("incomplete_data", "debt_risk")}


def test_status_out_of_scope_overrides_data_and_covers_unknown_countries():
    from src.calculating.mspi import mspi_country_status

    # KEN has complete data but is flagged out of scope; USA has no data and
    # no scope flag at all. Both are out of scope, never incomplete.
    out = mspi_country_status(_complete_components(), _metadata(KEN=False, USA=False))
    assert _status_map(out) == {"KEN": ("out_of_scope", ""), "USA": ("out_of_scope", "")}


def test_status_without_metadata_marks_everything_out_of_scope():
    from src.calculating.mspi import mspi_country_status

    out = mspi_country_status(_complete_components(), None)
    assert _status_map(out) == {"KEN": ("out_of_scope", "")}


def test_status_scope_flag_parses_csv_strings():
    from src.calculating.mspi import mspi_country_status

    meta = pd.DataFrame([{"country_code": "KEN", "ids_in_scope": "True"}])
    assert _status_map(mspi_country_status(_complete_components(), meta)) == {"KEN": ("scored", "")}
