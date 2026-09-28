"""Country Macro Socio-Economic Performance Index (mspi) composer.

Client spec: ``docs/spec-macrosec-index.md`` (index_version 1.0).

Builds one ``MSPI_INDEX`` row per country-year whose four components are all
present. ``value`` is the higher-is-better composite on [0, 100].
``SimpleDirectionalScorer`` then flips to pipeline (higher = need) orientation.

Component series are *not* registered in the scorer factory; this composer
must run before ``score_indicators`` drops unknown series_codes.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

INDEX_VERSION = "1.0"
MSPI_SERIES_CODE = "MSPI_INDEX"
MSPI_INDICATOR = "Country Macro Socio-Economic Performance Index"

INCOME_SERIES = "NY.GDP.PCAP.CD"
WGI_EST_SERIES = ("VA.EST", "PV.EST", "GE.EST", "RQ.EST", "RL.EST", "CC.EST")
PV_GNI = "DT.DOD.PVLX.GN.ZS"
PV_EXP = "DT.DOD.PVLX.EX.ZS"
FV_GNI = "DT.DOD.DECT.GN.ZS"
FV_EXP = "DT.DOD.DECT.EX.ZS"
DS_EXP = "DT.TDS.DECT.EX.ZS"
CONCESSIONAL_PCT = "DT.DOD.ALLC.ZS"

LN_INCOME_LOWER = math.log(200.0)
LN_INCOME_UPPER = math.log(150_000.0)

TIER_STRONG_MIN = -0.20
TIER_MEDIUM_MIN = -0.80

THRESHOLDS = {
    "weak":   {"debt_gdp": 30.0, "debt_exports": 140.0, "ds_exports": 10.0},
    "medium": {"debt_gdp": 40.0, "debt_exports": 180.0, "ds_exports": 15.0},
    "strong": {"debt_gdp": 55.0, "debt_exports": 240.0, "ds_exports": 21.0},
}

_OUTPUT_COLS = [
    "country_code",
    "country_name",
    "year",
    "value",
    "indicator",
    "series_code",
    "debt_basis",
]

# Contract §3.1 status model. Frontend key, not series code, because the
# sidecar is joined on the published indicator key.
MSPI_FRONTEND_KEY = "mspi"
STATUS_SCORED = "scored"
STATUS_OUT_OF_SCOPE = "out_of_scope"
STATUS_INCOMPLETE = "incomplete_data"
STATUS_VALUES = (STATUS_SCORED, STATUS_OUT_OF_SCOPE, STATUS_INCOMPLETE)
STATUS_COLS = ["country_code", "indicator_key", "status", "missing_components"]

# Normalised component columns and the identifiers the contract exposes in
# missingComponents. Order matches the spec's component numbering.
_COMPONENT_NAMES = {
    "n_inc": "income",
    "n_frag": "fragility",
    "n_debt": "debt_risk",
    "n_conc": "concessionality",
}
_COMPONENT_COLS = tuple(_COMPONENT_NAMES)
_PANEL_COLS = ["country_code", "country_name", "year", *_COMPONENT_COLS, "debt_basis"]


def norm_income(gdp_pc: pd.Series) -> pd.Series:
    """Log min-max on ln(200)–ln(150000), clipped to [0, 1]. Null if gdp_pc <= 0."""
    gdp = pd.to_numeric(gdp_pc, errors="coerce")
    valid = gdp > 0
    logged = pd.Series(np.nan, index=gdp.index, dtype="float64")
    logged.loc[valid] = np.log(gdp.loc[valid].astype(float))
    span = LN_INCOME_UPPER - LN_INCOME_LOWER
    return ((logged - LN_INCOME_LOWER) / span).clip(0.0, 1.0)


def avg_wgi(est: pd.DataFrame) -> pd.Series:
    """Mean of available WGI EST dimensions; null if none present."""
    return est.apply(pd.to_numeric, errors="coerce").mean(axis=1, skipna=True)


def norm_fragility(avg: pd.Series) -> pd.Series:
    return ((pd.to_numeric(avg, errors="coerce") + 2.5) / 5.0).clip(0.0, 1.0)


def debt_tier(avg: pd.Series) -> pd.Series:
    """LIC-DSF carrying-capacity proxy from avg_wgi. Null if avg_wgi is null."""
    a = pd.to_numeric(avg, errors="coerce")
    out = pd.Series(pd.NA, index=a.index, dtype="object")
    out.loc[a >= TIER_STRONG_MIN] = "strong"
    out.loc[(a >= TIER_MEDIUM_MIN) & (a < TIER_STRONG_MIN)] = "medium"
    out.loc[a < TIER_MEDIUM_MIN] = "weak"
    return out


def _threshold_col(tier: pd.Series, key: str) -> pd.Series:
    lookup = {name: THRESHOLDS[name][key] for name in THRESHOLDS}
    return pd.to_numeric(tier.map(lookup), errors="coerce")


def debt_stock_basis(
    pv_gni: pd.Series,
    pv_exp: pd.Series,
    fv_gni: pd.Series,
    fv_exp: pd.Series,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Prefer both PV series; else both face-value series. Record the basis used."""
    pv_ok = pv_gni.notna() & pv_exp.notna()
    fv_ok = fv_gni.notna() & fv_exp.notna()
    basis = pd.Series(pd.NA, index=pv_gni.index, dtype="object")
    basis.loc[pv_ok] = "present_value"
    basis.loc[~pv_ok & fv_ok] = "face_value"
    v_gni = pd.Series(np.nan, index=pv_gni.index, dtype="float64")
    v_exp = pd.Series(np.nan, index=pv_gni.index, dtype="float64")
    v_gni.loc[pv_ok] = pv_gni.loc[pv_ok]
    v_exp.loc[pv_ok] = pv_exp.loc[pv_ok]
    v_gni.loc[~pv_ok & fv_ok] = fv_gni.loc[~pv_ok & fv_ok]
    v_exp.loc[~pv_ok & fv_ok] = fv_exp.loc[~pv_ok & fv_ok]
    return v_gni, v_exp, basis


def norm_debt_risk(
    tier: pd.Series,
    v_gni: pd.Series,
    v_exp: pd.Series,
    ds_exp: pd.Series,
) -> pd.Series:
    """Worst available ratio vs LIC-DSF thresholds → 1.0 / 0.5 / 0.0."""
    r_gni = pd.to_numeric(v_gni, errors="coerce") / _threshold_col(tier, "debt_gdp")
    r_exp = pd.to_numeric(v_exp, errors="coerce") / _threshold_col(tier, "debt_exports")
    r_ds = pd.to_numeric(ds_exp, errors="coerce") / _threshold_col(tier, "ds_exports")
    max_ratio = pd.concat([r_gni, r_exp, r_ds], axis=1).max(axis=1, skipna=True)
    out = pd.Series(np.nan, index=tier.index, dtype="float64")
    out.loc[max_ratio < 0.75] = 1.0
    out.loc[(max_ratio >= 0.75) & (max_ratio < 1.0)] = 0.5
    out.loc[max_ratio >= 1.0] = 0.0
    out.loc[tier.isna()] = np.nan
    return out


def norm_nonconcessional(concessional_pct: pd.Series) -> pd.Series:
    raw = 100.0 - pd.to_numeric(concessional_pct, errors="coerce")
    return (1.0 - (raw / 100.0).clip(0.0, 1.0))


def _one_series(df: pd.DataFrame, series_code: str, name: str) -> pd.DataFrame:
    if "series_code" not in df.columns:
        return pd.DataFrame(columns=["country_code", "year", name])
    sub = df.loc[df["series_code"] == series_code, ["country_code", "year", "value"]]
    if sub.empty:
        return pd.DataFrame(columns=["country_code", "year", name])
    sub = sub.copy()
    sub["year"] = pd.to_numeric(sub["year"], errors="coerce")
    sub["value"] = pd.to_numeric(sub["value"], errors="coerce")
    sub = sub.dropna(subset=["country_code", "year"]).drop_duplicates(
        ["country_code", "year"], keep="last"
    )
    return sub.rename(columns={"value": name})[["country_code", "year", name]]


def _component_panel(df: pd.DataFrame) -> pd.DataFrame:
    """One row per country-year with the four normalised components.

    Columns: ``country_code, country_name, year, n_inc, n_frag, n_debt,
    n_conc, debt_basis``. A component is NaN where its inputs are missing.
    Shared by the composer (which keeps complete rows) and the status
    derivation (which needs the incomplete ones too). Empty if no income
    series is present.
    """
    empty = pd.DataFrame(columns=_PANEL_COLS)
    if df is None or df.empty or "series_code" not in df.columns:
        return empty

    income = _one_series(df, INCOME_SERIES, "gdp_pc")
    conces = _one_series(df, CONCESSIONAL_PCT, "concessional_pct")
    wgi_frames = [_one_series(df, code, code) for code in WGI_EST_SERIES]
    pv_gni = _one_series(df, PV_GNI, "pv_gni")
    pv_exp = _one_series(df, PV_EXP, "pv_exp")
    fv_gni = _one_series(df, FV_GNI, "fv_gni")
    fv_exp = _one_series(df, FV_EXP, "fv_exp")
    ds_exp = _one_series(df, DS_EXP, "ds_exp")

    panel = income
    for frame in (
        conces,
        *wgi_frames,
        pv_gni,
        pv_exp,
        fv_gni,
        fv_exp,
        ds_exp,
    ):
        if frame.empty:
            continue
        panel = panel.merge(frame, on=["country_code", "year"], how="outer")

    if panel.empty:
        return empty

    for col in WGI_EST_SERIES:
        if col not in panel.columns:
            panel[col] = np.nan
    for col in ("gdp_pc", "concessional_pct", "pv_gni", "pv_exp", "fv_gni", "fv_exp", "ds_exp"):
        if col not in panel.columns:
            panel[col] = np.nan

    names = (
        df.dropna(subset=["country_code"])
        .drop_duplicates("country_code", keep="last")[["country_code", "country_name"]]
        if "country_name" in df.columns
        else pd.DataFrame(columns=["country_code", "country_name"])
    )
    panel = panel.merge(names, on="country_code", how="left")

    n_inc = norm_income(panel["gdp_pc"])
    avg = avg_wgi(panel[list(WGI_EST_SERIES)])
    n_frag = norm_fragility(avg)
    tier = debt_tier(avg)
    v_gni, v_exp, basis = debt_stock_basis(
        panel["pv_gni"], panel["pv_exp"], panel["fv_gni"], panel["fv_exp"]
    )
    n_debt = norm_debt_risk(tier, v_gni, v_exp, panel["ds_exp"])
    n_conc = norm_nonconcessional(panel["concessional_pct"])

    out = pd.DataFrame(
        {
            "country_code": panel["country_code"].values,
            "country_name": panel["country_name"].values,
            "year": panel["year"].values,
            "n_inc": n_inc.to_numpy(),
            "n_frag": n_frag.to_numpy(),
            "n_debt": n_debt.to_numpy(),
            "n_conc": n_conc.to_numpy(),
            "debt_basis": basis.values,
        }
    )
    return out[_PANEL_COLS].reset_index(drop=True)


def compose_mspi_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Return tidy ``MSPI_INDEX`` rows. Empty if any required series is absent."""
    empty = pd.DataFrame(columns=_OUTPUT_COLS)
    panel = _component_panel(df)
    if panel.empty:
        return empty

    complete = panel[list(_COMPONENT_COLS)].notna().all(axis=1)
    if not complete.any():
        return empty

    value = 100.0 * sum(0.25 * panel[col] for col in _COMPONENT_COLS)
    out = pd.DataFrame(
        {
            "country_code": panel.loc[complete, "country_code"].values,
            "country_name": panel.loc[complete, "country_name"].values,
            "year": panel.loc[complete, "year"].values,
            "value": value.loc[complete].to_numpy(),
            "indicator": MSPI_INDICATOR,
            "series_code": MSPI_SERIES_CODE,
            "debt_basis": panel.loc[complete, "debt_basis"].values,
        }
    )
    return out[_OUTPUT_COLS].reset_index(drop=True)


def mspi_country_status(
    df: pd.DataFrame,
    country_metadata: pd.DataFrame | None,
) -> pd.DataFrame:
    """Country-level ``status`` for the mspi indicator (contract §3.1).

    Columns: ``country_code, indicator_key, status, missing_components``.

    Scope comes from ``country_metadata.ids_in_scope`` (World Bank
    ``lendingType.id`` resolved by ``WorldBankCleaner.clean_country_metadata``),
    the rule as written in the client's 2026-09-23 revision. Countries absent
    from the metadata are not IBRD / IDA / blend borrowers and are therefore
    out of scope.

    Status is country-level because lending classification has no history.
    ``incomplete_data`` means no year has a complete component set;
    ``missing_components`` then lists the components absent in the most recent
    year that has any component at all, so the list is never empty on that
    status. ``missing_components`` is a ``|``-joined string so it survives CSV.
    """
    scope: dict[str, bool] = {}
    if country_metadata is not None and not country_metadata.empty:
        meta = country_metadata.dropna(subset=["country_code"])
        flags = meta["ids_in_scope"].map(
            lambda v: str(v).strip().lower() in {"true", "1", "yes"}
        )
        scope = dict(zip(meta["country_code"].astype(str), flags))

    panel = _component_panel(df)
    countries: set[str] = set(scope)
    if not panel.empty:
        countries |= set(panel["country_code"].dropna().astype(str))

    rows = []
    for code in sorted(countries):
        if not scope.get(code, False):
            rows.append((code, MSPI_FRONTEND_KEY, STATUS_OUT_OF_SCOPE, ""))
            continue
        sub = panel[panel["country_code"] == code] if not panel.empty else panel
        comp = sub[list(_COMPONENT_COLS)] if not sub.empty else pd.DataFrame(columns=list(_COMPONENT_COLS))
        if not comp.empty and comp.notna().all(axis=1).any():
            rows.append((code, MSPI_FRONTEND_KEY, STATUS_SCORED, ""))
            continue
        any_data = comp.notna().any(axis=1) if not comp.empty else pd.Series(dtype=bool)
        if any_data.any():
            latest = sub.loc[any_data].sort_values("year").iloc[-1]
            missing = [name for col, name in _COMPONENT_NAMES.items() if pd.isna(latest[col])]
        else:
            missing = list(_COMPONENT_NAMES.values())
        rows.append((code, MSPI_FRONTEND_KEY, STATUS_INCOMPLETE, "|".join(missing)))

    return pd.DataFrame(rows, columns=STATUS_COLS)


def append_mspi_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Concat composed rows onto the interim frame. No-op if none compose."""
    extra = compose_mspi_rows(df)
    if extra.empty:
        return df
    return pd.concat([df, extra], ignore_index=True, sort=False)
