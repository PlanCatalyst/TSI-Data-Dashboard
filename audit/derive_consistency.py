"""Audit: pipeline record accounting, published-file consistency, benchmark constants.

Consistency agent (may import src and read pipeline intermediates). Run from repo root:

    .venv/bin/python audit/derive_consistency.py

Writes audit/results/consistency_accounting.csv and audit/findings/consistency.md.
Writes nothing into audit/expected/.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

from src.calculating.dimensions import (  # noqa: E402
    DIMENSION_COLUMNS, KEY, SERIES_RULES, _GENERIC_TOTALS, select_dimensions,
)
from src.calculating.factory import IndicatorScorerFactory  # noqa: E402
from src.calculating.mspi import (  # noqa: E402
    CONCESSIONAL_PCT, DS_EXP, FV_EXP, FV_GNI, INCOME_SERIES, MSPI_SERIES_CODE,
    PV_EXP, PV_GNI, WGI_EST_SERIES, _component_panel, append_mspi_rows,
)
from src.calculating.pillar_taxonomy import load_taxonomy  # noqa: E402
from src.calculating.pipeline import (  # noqa: E402
    _apply_agoda_gdp_normalization, load_harmonized_interim, scoring_inputs,
)
from src.utils.country_identity import m49_to_iso3, name_to_iso3, resolve  # noqa: E402

RUN_ID = "20261015T001106Z"
STORE = ROOT / "data" / "store" / RUN_ID
PUB = ROOT / "dashboard" / "public" / "v1"
OUT_CSV = ROOT / "audit" / "results" / "consistency_accounting.csv"
OUT_MD = ROOT / "audit" / "findings" / "consistency.md"

ISO3_RE = re.compile(r"^[A-Z]{3}$")

# ---------------------------------------------------------------------------
# Load published files, taxonomy, settings
# ---------------------------------------------------------------------------
meta = json.load(open(PUB / "meta.json"))
countries = json.load(open(PUB / "countries.json"))


def _reject_const(name):  # NaN / Infinity literal in a published file
    raise ValueError(f"non-JSON constant {name} in published file")


ts_nan_literals = 0
try:
    ts = json.load(open(PUB / "timeseries.json"), parse_constant=_reject_const)
except ValueError:
    ts_nan_literals = 1
    ts = json.load(open(PUB / "timeseries.json"))
YEARS = meta["years"]
tax = load_taxonomy()
KEY2SERIES = {t.frontend_key: t.series_code for t in tax}
SERIES2KEY = {t.series_code: t.frontend_key for t in tax if t.series_code}
KEYS = [t.frontend_key for t in tax]
settings = yaml.safe_load(open(ROOT / "src" / "config" / "settings.yaml"))
codes_df = pd.read_csv(ROOT / "indicators" / "country_codes.csv")
CODES = set(codes_df["iso3"])
wbmeta = pd.read_csv(ROOT / "data" / "clean" / "world-bank" / "wb_country_metadata.csv")
WBMETA = set(wbmeta["country_code"])
pillar_scores = pd.read_csv(ROOT / "data" / "interim" / "validated" / "pillarscores.csv")
VALID_ISO3 = set(pillar_scores["country_code"].unique()) & CODES
scored_full = pd.read_csv(ROOT / "data" / "interim" / "validated" / "Indicator_Scores_Full.csv", low_memory=False)

# Frames as the pipeline built them
unsdg_csv, extras, _meta_csv = scoring_inputs(settings["runtime"], ROOT)
clean_all = pd.concat(
    [pd.read_csv(p, low_memory=False) for p in [unsdg_csv, *extras] if Path(p).exists()],
    ignore_index=True, sort=False,
)
df_harm = load_harmonized_interim(unsdg_csv, extras)
df_gdp = _apply_agoda_gdp_normalization(df_harm)
df_mspi = append_mspi_rows(df_gdp)
df_dims = select_dimensions(df_mspi)

acct: list[dict] = []
unexplained: list[tuple] = []


def emit(key, series, stage, rows, prev, reasons, expect_zero_unexplained=True):
    """reasons: list of (label, count). Residual vs prev-rows becomes UNEXPLAINED."""
    dropped = 0 if prev is None else prev - rows
    explained = sum(c for _, c in reasons)
    parts = [f"{lbl}: {c}" for lbl, c in reasons if c]
    resid = dropped - explained
    if prev is not None and resid != 0:
        parts.append(f"UNEXPLAINED: {resid}")
        unexplained.append((key, series, stage, resid, dropped))
    acct.append(dict(indicator_key=key, series=series, stage=stage, rows=int(rows),
                     dropped_from_previous=("" if prev is None else int(dropped)),
                     reason="; ".join(parts)))


# ---------------------------------------------------------------------------
# Raw-store readers
# ---------------------------------------------------------------------------
_sdg_cache = {}


def sdg_raw():
    if "df" not in _sdg_cache:
        d = pd.read_csv(STORE / "unsdg" / "records.csv", low_memory=False,
                        usecols=["indicator", "series", "geoAreaCode", "value", "timePeriodStart"])
        d["ind0"] = d["indicator"].map(lambda s: (json.loads(s) or [None])[0] if isinstance(s, str) else None)
        _sdg_cache["df"] = d
    return _sdg_cache["df"]


_wb_cache = {}


def wb_raw():
    if "df" not in _wb_cache:
        _wb_cache["df"] = pd.read_csv(STORE / "worldbank" / "records.csv", low_memory=False,
                                      usecols=["countryiso3code", "date", "value", "indicator.id"])
    return _wb_cache["df"]


SDG_ID_OF_SERIES = {t.series_code: t.sdg_id for t in tax if t.sdg_id}
WGI_SHEET = {"WGI_GOVEFF": ("ge", "Governance score (0-100)")}
for sc in WGI_EST_SERIES:
    WGI_SHEET[sc] = (sc.split(".")[0].lower(), "Governance estimate (approx. -2.5 to +2.5)")


def raw_to_clean(series):
    """Return (source_label, raw_rows, clean_expected_rows, reasons_to_clean).

    raw_rows are store records (one per country-year observation; for wide files
    one per country x year cell, for sheets one per sheet row).
    """
    if series in SDG_ID_OF_SERIES:
        d = sdg_raw()
        s = d[d["series"] == series]
        target = SDG_ID_OF_SERIES[series]
        wrong_ind = int((s["ind0"] != target).sum())
        s2 = s[s["ind0"] == target]
        unmapped = int(s2["geoAreaCode"].map(m49_to_iso3).isna().sum())
        return ("unsdg", len(s), len(s2) - unmapped,
                [(f"indicator tag != {target} (series filter)", wrong_ind),
                 ("geoAreaCode not mapped to ISO3 (world/region/aggregate M49 codes)", unmapped)])
    if series in ("EN.POP.DNST", "NY.GDP.MKTP.CD", "NY.GDP.PCAP.CD", PV_GNI, PV_EXP, FV_GNI, FV_EXP,
                  DS_EXP, CONCESSIONAL_PCT):
        d = wb_raw()
        s = d[d["indicator.id"] == series]
        return ("worldbank", len(s), len(s), [])  # WB cleaner keeps every record, nulls included
    if series == "ND_GAIN_VULN":
        r = pd.read_csv(STORE / "ndgain" / "records.csv", low_memory=False)
        r = r[r["indicator"] == "vulnerability"]
        ycols = [c for c in r.columns if str(c).isdigit()]
        cells = r[ycols].apply(pd.to_numeric, errors="coerce")
        nulls = int(cells.isna().sum().sum())
        return ("ndgain", cells.size, cells.size - nulls, [("null/non-numeric year cell (melt then dropna)", nulls)])
    if series in ("GII_INDEX", "HDI_INDEX"):
        prefix = "gii_" if series == "GII_INDEX" else "hdi_"
        r = pd.read_csv(STORE / "undp_hdr" / "files" / "composite_indices.csv", encoding="latin-1", low_memory=False)
        ycols = [c for c in r.columns if re.match(rf"^{prefix}(19|20)\d{{2}}$", str(c))]
        sub = r[["iso3", *ycols]]
        vals = sub[ycols].apply(pd.to_numeric, errors="coerce")
        total = vals.size
        nulls = int(vals.isna().sum().sum())
        ok_code = sub["iso3"].astype(str).str.match(ISO3_RE)
        nonnull = vals.notna()
        agg = int(nonnull[~ok_code].sum().sum())
        return ("undp_hdr", total, int(nonnull[ok_code].sum().sum()),
                [("null/non-numeric cell", nulls), ("aggregate/region row (iso3 not 3 letters)", agg)])
    if series == "MPI_INDEX":
        r = pd.read_csv(STORE / "undp_hdr" / "sheets" / "mpi__gMPI_Table2.csv", header=None, skiprows=5,
                        low_memory=False)
        n = len(r)
        lab = r.iloc[:, 0].ffill()
        yl = r.iloc[:, 2].astype(str)
        from src.clean.undp_hdr_clean import UNDPHDRCleaner
        is_sy = yl.apply(UNDPHDRCleaner._is_survey_year_string)
        notsurvey = int((~is_sy).sum())
        val = pd.to_numeric(r.iloc[:, 4], errors="coerce")
        s_ok = is_sy
        nullv = int((s_ok & val.isna()).sum())
        ok = s_ok & val.notna()
        resolved = lab[ok].map(name_to_iso3)
        unres = int(resolved.isna().sum())
        return ("undp_hdr", n, int(ok.sum()) - unres,
                [("row is not a survey-wave row (header, footnote, blank)", notsurvey),
                 ("null MPI value", nullv), ("country name unresolved to ISO3", unres)])
    if series == "WGI_GOVEFF" or series in WGI_EST_SERIES:
        sheet, col = WGI_SHEET[series]
        r = pd.read_csv(STORE / "wb_wgi" / "sheets" / f"wgi_dataset__{sheet}.csv", low_memory=False)
        yr = pd.to_numeric(r["Year"], errors="coerce")
        v = pd.to_numeric(r[col], errors="coerce")
        bad = yr.isna() | v.isna()
        code_ok = r["Economy (code)"].astype(str).str.strip().str.match(ISO3_RE)
        agg = int((~bad & ~code_ok).sum())
        return ("wb_wgi", len(r), int((~bad & code_ok).sum()),
                [("null year or null/non-numeric score", int(bad.sum())),
                 ("economy code not 3 capital letters (aggregate)", agg)])
    return (None, None, None, [])


def count_series(df, series):
    return int((df["series_code"] == series).sum()) if "series_code" in df.columns else 0


# ---------------------------------------------------------------------------
# Dimension-selection replica (counts per reason; must agree with src)
# ---------------------------------------------------------------------------
def dims_replica(sdf, series):
    reasons = []
    n0 = len(sdf)
    rule = SERIES_RULES.get(str(series), {})
    if "keep" in rule:
        for col, val in rule["keep"].items():
            if col in sdf.columns:
                before = len(sdf)
                sdf = sdf[sdf[col] == val]
                reasons.append((f"series rule keep {col}={val} (other bands removed)", before - len(sdf)))
    if "mean_over" in rule:
        col = rule["mean_over"]
        if col in sdf.columns and sdf[col].notna().any():
            before = len(sdf)
            sdf = sdf.groupby(["country_code", "year"], dropna=False, sort=False).first().reset_index()
            reasons.append((f"mean over {col} (rows collapsed to one per country-year)", before - len(sdf)))
    # Series-level totals (DQ-11): if the series reports the total in a
    # dimension anywhere, every non-total, non-blank row in that dimension goes,
    # including a lone URBAN row with no duplicate.
    step = defaultdict(int)
    for col, total in _GENERIC_TOTALS:
        if col in sdf.columns and (sdf[col] == total).any():
            m = sdf[col].isna() | (sdf[col] == total)
            step[f"generic total {col}={total}"] += int((~m).sum())
            sdf = sdf[m]
    dup = sdf.duplicated(KEY, keep=False)
    left_conflict = 0
    if dup.any():
        kept = len(sdf[~dup])
        for _, g in sdf[dup].groupby(["country_code", "year"], dropna=False, sort=False):
            if len(g) > 1 and g["value"].nunique(dropna=False) == 1:
                step["identical-value duplicates collapsed"] += len(g) - 1
                g = g.iloc[[0]]
            if len(g) > 1:
                left_conflict += len(g)
            kept += len(g)
        sdf_len = kept
    else:
        sdf_len = len(sdf)
    reasons += [(f"{k} (non-total dimension rows removed)" if k.startswith("generic") else k, v)
                for k, v in step.items() if v]
    return sdf_len, reasons, left_conflict


# ---------------------------------------------------------------------------
# Check 1: record accounting
# ---------------------------------------------------------------------------
agoda_nogdp_info = {}
conflict_info = {}
publish_dropped_codes: dict = defaultdict(int)
published_nonnull = {k: sum(1 for iso in ts for v in ts[iso][k] if v is not None) for k in KEYS}


def after_scoring_stages(key, series, prev_rows):
    """dimension_selected -> scored_nonnull -> published_nonnull; returns None."""
    sdf2 = df_mspi[df_mspi["series_code"] == series]
    n_in = len(sdf2)
    n_dims_src = count_series(df_dims, series)
    n_dims, reasons, left_conflict = dims_replica(sdf2, series)
    emit(key, series, "dimension_selected", n_dims_src, n_in, reasons)
    if n_dims != n_dims_src:
        unexplained.append((key, series, "dims replica vs src.select_dimensions", n_dims - n_dims_src, 0))
    if left_conflict:
        conflict_info[key] = left_conflict
    sc = scored_full[scored_full["series_code"] == series]
    if len(sc) != n_dims_src:
        unexplained.append((key, series, "Indicator_Scores_Full rows vs recomputed select_dimensions", len(sc) - n_dims_src, 0))
    nullv = int(sc["value"].isna().sum())
    nonnull_val = sc[sc["value"].notna()]
    score_null = int(nonnull_val["score"].isna().sum())
    scored_nn = sc[sc["score"].notna()]
    emit(key, series, "scored_nonnull", len(scored_nn), len(sc),
         [("null observation value (score stays null)", nullv),
          ("non-null value but scorer returned null", score_null)])
    # publisher
    pubset = scored_nn.copy()
    pubset["country_code"] = pubset["country_code"].astype(str)
    ndup = len(pubset) - len(pubset.drop_duplicates(["country_code", "year"]))
    u = pubset.drop_duplicates(["country_code", "year"])
    out_year = int((~u["year"].isin(YEARS)).sum())
    u = u[u["year"].isin(YEARS)]
    not_valid = u[~u["country_code"].isin(VALID_ISO3)]
    labels = defaultdict(int)
    for c, n_c in not_valid["country_code"].value_counts().items():
        publish_dropped_codes[c] += int(n_c)
    for c in not_valid["country_code"]:
        if c in CODES:
            labels["in country_codes.csv but absent from pillarscores.csv"] += 1
        elif c in WBMETA:
            labels["WB economy not in the 216-row country_codes.csv"] += 1
        else:
            labels["aggregate / region / territory code not in country_codes.csv"] += 1
    u = u[u["country_code"].isin(VALID_ISO3)]
    pub = published_nonnull[key]
    reasons = [("duplicate country-year after dimension selection (publisher keeps first)", ndup),
               ("year outside meta.years", out_year)] + list(labels.items())
    emit(key, series, "published_nonnull", pub, len(scored_nn), reasons)
    if len(u) != pub:
        unexplained.append((key, series, "published count vs recomputed (valid-iso3, in-window) rows", len(u) - pub, 0))


def raw_stages(key, series, with_after=True, label=None):
    src_label, raw_n, exp_clean, rs = raw_to_clean(series)
    clean_n = count_series(clean_all, series)
    harm_n = count_series(df_harm, series)
    emit(key, series, "raw_store", raw_n if raw_n is not None else 0, None, [])
    emit(key, series, "cleaned", clean_n, raw_n, rs)
    if exp_clean is not None and exp_clean != clean_n:
        unexplained.append((key, series, "cleaned rows vs independent expectation", clean_n - exp_clean, 0))
    # iso3 harmonization
    cs = clean_all[clean_all["series_code"] == series]["country_code"]
    nulls = int(cs.isna().sum())
    unres = int(cs.dropna().map(resolve).isna().sum())
    emit(key, series, "iso3_harmonized", harm_n, clean_n,
         [("country_code empty", nulls), ("code not resolvable to ISO3", unres)])
    return harm_n


for t in tax:
    key, series = t.frontend_key, t.series_code
    if key == "mspi":
        continue
    harm_n = raw_stages(key, series)
    if series == "DC_TOF_AGRL":
        a = df_harm[df_harm["series_code"] == series]
        gdp = df_harm[df_harm["series_code"] == "NY.GDP.MKTP.CD"].dropna(subset=["value"])
        gdp = gdp[gdp["value"].astype(float) > 0].drop_duplicates(["country_code", "year"])[["country_code", "year"]]
        gdp["_g"] = 1
        m = a.merge(gdp, on=["country_code", "year"], how="left")
        nogdp = m[m["_g"].isna() & m["value"].notna()]
        agoda_nogdp_info = dict(n=len(nogdp), of=int(a["value"].notna().sum()), frame=nogdp)
        emit(key, series, "gdp_normalised (check)", harm_n, harm_n,
             [], )
        acct[-1]["reason"] = (f"no rows dropped; {len(nogdp)} non-null rows have no GDP>0 for the same country-year "
                              f"and are left in raw USD millions, then scored against a 0.02 ratio goal")
    after_scoring_stages(key, series, harm_n)

# mspi: component series, then composed rows
mspi_components = [INCOME_SERIES, *WGI_EST_SERIES, PV_GNI, PV_EXP, FV_GNI, FV_EXP, DS_EXP, CONCESSIONAL_PCT]
for comp in mspi_components:
    raw_stages("mspi", comp)
panel = _component_panel(df_harm)
n_panel = len(panel)
complete = int(panel[["n_inc", "n_frag", "n_debt", "n_conc"]].notna().all(axis=1).sum())
n_comp_rows = count_series(df_mspi, MSPI_SERIES_CODE)
emit("mspi", MSPI_SERIES_CODE, "composed (component panel country-years)", n_panel, None, [])
emit("mspi", MSPI_SERIES_CODE, "composed_complete", n_comp_rows, n_panel,
     [("one or more of income/fragility/debt_risk/concessionality missing (null if any component null)",
       n_panel - complete)])
if complete != n_comp_rows:
    unexplained.append(("mspi", MSPI_SERIES_CODE, "composed rows vs panel complete rows", complete - n_comp_rows, 0))
after_scoring_stages("mspi", MSPI_SERIES_CODE, n_comp_rows)

acct_df = pd.DataFrame(acct, columns=["indicator_key", "series", "stage", "rows", "dropped_from_previous", "reason"])
acct_df.to_csv(OUT_CSV, index=False)

# ---------------------------------------------------------------------------
# Check 2: published files against each other
# ---------------------------------------------------------------------------
c2: list[tuple[str, str, str]] = []  # (check, status, detail)


def chk(name, ok, detail=""):
    c2.append((name, "PASS" if ok else "FAIL", detail))


ts_iso = set(ts)
c_iso = {c["iso3"] for c in countries}
chk("every ts iso3 is in countries.json", ts_iso <= c_iso, f"missing from countries: {sorted(ts_iso - c_iso)}")
chk("every countries.json iso3 is in ts", c_iso <= ts_iso, f"missing from ts: {sorted(c_iso - ts_iso)}")
chk("countries.json iso3 unique", len(c_iso) == len(countries), f"{len(countries)} entries, {len(c_iso)} unique")
chk("countries.json iso3 all in country_codes.csv", c_iso <= CODES, str(sorted(c_iso - CODES)))
chk("country_codes.csv rows all published", CODES <= c_iso, f"unpublished: {sorted(CODES - c_iso)}")
ids = {c["iso3"]: c["id"] for c in countries}
want_id = {r.iso3: int(r.iso_numeric) for r in codes_df.itertuples()}
bad_id = [i for i in ids if ids[i] != want_id.get(i)]
chk("countries.json numeric id equals country_codes.csv iso_numeric", not bad_id, str(bad_id[:10]))
mkeys = [i["key"] for i in meta["indicators"]]
bad_keys = [iso for iso in ts if set(ts[iso]) != set(mkeys)]
chk("every ts country has exactly the meta.indicators keys", not bad_keys, f"{len(bad_keys)} countries differ")
chk("meta.indicators keys == yaml frontend_keys (order too)", mkeys == KEYS, f"meta={mkeys}\nyaml={KEYS}" if mkeys != KEYS else "")
bad_len = [(iso, k, len(v)) for iso in ts for k, v in ts[iso].items() if len(v) != len(YEARS)]
chk("series length == len(meta.years)", not bad_len, str(bad_len[:5]))
chk("meta.years contiguous", YEARS == list(range(YEARS[0], YEARS[-1] + 1)), f"{YEARS[0]}-{YEARS[-1]}")
bad_type, oor, nan_cnt, bool_cnt = [], [], 0, 0
zero_ct = defaultdict(int)
for iso in ts:
    for k, arr in ts[iso].items():
        for i, v in enumerate(arr):
            if v is None:
                continue
            if isinstance(v, bool):
                bool_cnt += 1
                continue
            if not isinstance(v, (int, float)):
                bad_type.append((iso, k, i, v))
                continue
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                nan_cnt += 1
                continue
            if v < 0 or v > 100:
                oor.append((iso, k, YEARS[i], v))
            if v == 0:
                zero_ct[k] += 1
chk("ts values are null or numbers (no strings, bools)", not bad_type and not bool_cnt, str(bad_type[:5]))
chk("no NaN / Infinity in timeseries.json", nan_cnt == 0 and not ts_nan_literals, f"{nan_cnt} NaN/inf, literal parse flag {ts_nan_literals}")
chk("all ts values in [0,100]", not oor, f"{len(oor)} out of range, first: {oor[:5]}")
# An offline rerun snapshots the same data/raw under a new run id; accept it
# only when every source file is byte-identical to the audited store.
_pub_store = ROOT / "data" / "store" / str(meta["pipelineRunId"])
_same_raw = meta["pipelineRunId"] == RUN_ID or (
    _pub_store.is_dir()
    and all(
        (_pub_store / f.relative_to(STORE)).is_file()
        and (_pub_store / f.relative_to(STORE)).read_bytes() == f.read_bytes()
        for f in STORE.rglob("records.csv")
    )
)
chk("meta.pipelineRunId is the audited store or a byte-identical copy", _same_raw, str(meta["pipelineRunId"]))
chk("meta counts 8 / 7 / 17 / 28", (len(meta["regions"]), len(meta["pillars"]), len(meta["subdomains"]), len(meta["indicators"])) == (8, 7, 17, 28),
    str((len(meta["regions"]), len(meta["pillars"]), len(meta["subdomains"]), len(meta["indicators"]))))
# countries.json
region_codes = {r["code"] for r in meta["regions"]}
bad_reg = [c["iso3"] for c in countries if c["region"] not in region_codes]
chk("countries region in meta.regions", not bad_reg, str(bad_reg[:10]))
bad_trend = [c["iso3"] for c in countries if len(c["trend"]) != len(YEARS)]
chk("trend length == len(meta.years)", not bad_trend, str(bad_trend[:10]))
pkeys = [p["key"] for p in meta["pillars"]]
bad_sc = [c["iso3"] for c in countries if list(c["scores"]) != pkeys]
chk("scores keys == meta.pillars keys", not bad_sc, str(bad_sc[:10]))
sc_oor = [(c["iso3"], k, v) for c in countries for k, v in c["scores"].items() if v is not None and not (0 <= v <= 100)]
sc_oor += [(c["iso3"], "overall", c["overall"]) for c in countries if c["overall"] is not None and not (0 <= c["overall"] <= 100)]
sc_oor += [(c["iso3"], "trend", v) for c in countries for v in c["trend"] if v is not None and not (0 <= v <= 100)]
chk("countries scores / overall / trend in [0,100]", not sc_oor, str(sc_oor[:5]))
bad_overall = []
for c in countries:
    pres = [v for v in c["scores"].values() if v is not None]
    exp = round(sum(pres) / len(pres), 1) if pres else None
    if (exp is None) != (c["overall"] is None) or (exp is not None and abs(exp - c["overall"]) > 0.051):
        bad_overall.append((c["iso3"], c["overall"], exp))
chk("overall == mean of available pillar scores (publisher rule)", not bad_overall, str(bad_overall[:5]))
# contract says overall is null if any pillar is null
n_overall_with_null_pillar = sum(1 for c in countries if c["overall"] is not None and any(v is None for v in c["scores"].values()))
c2.append(("contract: overall null if any pillar null", "NOTE",
           f"{n_overall_with_null_pillar} of {len(countries)} countries carry a non-null overall with at least one null pillar "
           f"(publisher computes mean of present pillars; contract text in docs/data-contract.md section 3 says null)"))
# meta vs yaml taxonomy
ymap = {t.frontend_key: (t.pillar_key, t.subdomain_key) for t in tax}
bad_pm = [(i["key"], i["pillar"], i["subdomain"]) for i in meta["indicators"] if (i["pillar"], i["subdomain"]) != ymap.get(i["key"])]
chk("meta.indicators pillar/subdomain == yaml", not bad_pm, str(bad_pm))
y = yaml.safe_load(open(ROOT / "indicators" / "indicators.yaml"))
ysub = {s["key"]: p["key"] for p in y["pillars"] for s in p["subdomains"]}
msub = {s["key"]: s["pillar"] for s in meta["subdomains"]}
chk("meta.subdomains key -> pillar == yaml", ysub == msub, f"yaml-only {set(ysub.items()) - set(msub.items())}; meta-only {set(msub.items()) - set(ysub.items())}")
chk("meta.pillars keys == yaml pillar keys", pkeys == [p["key"] for p in y["pillars"]], f"{pkeys} vs {[p['key'] for p in y['pillars']]}")
rep_ok = all(p["repIndicator"] in mkeys for p in meta["pillars"])
chk("meta.pillars repIndicator is a real indicator key", rep_ok)
rep_in_pillar = [(p["key"], p["repIndicator"]) for p in meta["pillars"] if ymap.get(p["repIndicator"], (None,))[0] != p["key"]]
chk("repIndicator belongs to its pillar", not rep_in_pillar, str(rep_in_pillar))
# indicatorStatus invariants (contract 3.1)
inv_bad = []
status_counts = defaultdict(int)
for c in countries:
    st = (c.get("indicatorStatus") or {}).get("mspi")
    if st is None:
        inv_bad.append((c["iso3"], "no mspi status"))
        continue
    status_counts[st["status"]] += 1
    arr = ts[c["iso3"]]["mspi"]
    nn = sum(v is not None for v in arr)
    if st["status"] == "scored" and nn == 0:
        inv_bad.append((c["iso3"], "scored but all-null ts"))
    if st["status"] != "scored" and nn > 0:
        inv_bad.append((c["iso3"], f"{st['status']} but {nn} non-null ts"))
    if (st["status"] == "incomplete_data") != bool(st["missingComponents"]):
        inv_bad.append((c["iso3"], "missingComponents rule"))
chk("indicatorStatus invariants (scored needs non-null ts; others all-null; missingComponents rule)", not inv_bad,
    f"{dict(status_counts)}; violations {inv_bad[:8]}")

# recompute pillar/overall from timeseries with the basket rule (docs section 6)
BASKET_W, BASKET_MIN = 5, 0.75


def basket(wide):
    """wide: DataFrame index=year, columns=members."""
    anyp = wide.notna().any(axis=1)
    if not anyp.any():
        return pd.Series(np.nan, index=wide.index)
    last = wide.index[anyp].max()
    win = wide[(wide.index > last - BASKET_W) & (wide.index <= last)]
    members = [c for c in wide.columns if win[c].notna().any()]
    if not members:
        return pd.Series(np.nan, index=wide.index)
    need = max(1, math.ceil(BASKET_MIN * len(members)))
    sub = wide[members]
    return sub.mean(axis=1).where(sub.notna().sum(axis=1) >= need)


sub_members = defaultdict(list)
pil_members = defaultdict(list)
for t in tax:
    sub_members[(t.pillar_key, t.subdomain_key)].append(t.frontend_key)
for (p, s) in sub_members:
    pil_members[p].append(s)
snap_bad, trend_bad, n_snap, n_trend = [], [], 0, 0
max_snap = max_trend = 0.0
for c in countries:
    iso = c["iso3"]
    subs = {}
    for (p, s), mem in sub_members.items():
        w = pd.DataFrame({m: pd.Series(ts[iso][m], index=YEARS, dtype="float64") for m in mem})
        subs[(p, s)] = basket(w)
    pillars = {}
    for p, ss in pil_members.items():
        w = pd.DataFrame({s: subs[(p, s)] for s in ss})
        pillars[p] = basket(w)
    for p in pkeys:
        s = pillars[p].dropna()
        exp = float(s.iloc[-1]) if len(s) else None
        got = c["scores"][p]
        n_snap += 1
        if (exp is None) != (got is None):
            snap_bad.append((iso, p, got, exp))
        elif exp is not None:
            d = abs(exp - got)
            max_snap = max(max_snap, d)
            if d > 0.3:
                snap_bad.append((iso, p, got, round(exp, 1)))
    pdf = pd.DataFrame(pillars)
    gapped = {p for p in pkeys if all(pd.isna(cc["scores"][p]) for cc in countries)}
    need_cols = [p for p in pkeys if p not in gapped]
    for i, yr in enumerate(YEARS):
        row = pdf.loc[yr]
        if row[need_cols].isna().any():
            exp = None
        else:
            av = row.dropna()
            exp = float(av.mean()) if len(av) else None
        got = c["trend"][i]
        n_trend += 1
        if (exp is None) != (got is None):
            trend_bad.append((iso, yr, got, exp))
        elif exp is not None:
            d = abs(exp - got)
            max_trend = max(max_trend, d)
            if d > 0.3:
                trend_bad.append((iso, yr, got, round(exp, 1)))
chk("countries.scores == pillar recomputed from timeseries (basket rule, tol 0.3)", not snap_bad,
    f"{len(snap_bad)}/{n_snap} differ, max abs diff among matched {max_snap:.2f}; first: {snap_bad[:6]}")
chk("countries.trend == overall recomputed from timeseries (basket rule, tol 0.3)", not trend_bad,
    f"{len(trend_bad)}/{n_trend} differ, max abs diff among matched {max_trend:.2f}; first: {trend_bad[:6]}")

# zero-standing-in-for-missing: each published 0.0 must trace to a scored row with non-null value and score 100
zero_trace_bad = []
lookup = scored_full[scored_full["score"].notna() & scored_full["value"].notna()].copy()
lookup["series_key"] = lookup["series_code"].map(SERIES2KEY)
lk = lookup.dropna(subset=["series_key"]).drop_duplicates(["country_code", "series_key", "year"]).set_index(
    ["country_code", "series_key", "year"])["score"]
n_zero = 0
for iso in ts:
    for k, arr in ts[iso].items():
        for i, v in enumerate(arr):
            if v == 0:
                n_zero += 1
                sc_v = lk.get((iso, k, YEARS[i]))
                if sc_v is None or abs(float(sc_v) - 100.0) > 0.06:
                    zero_trace_bad.append((iso, k, YEARS[i], sc_v))
chk("every published 0.0 traces to a non-null raw value scored at need 100", not zero_trace_bad,
    f"{n_zero} zeros; untraceable: {zero_trace_bad[:6]}")

# ---------------------------------------------------------------------------
# Check 3: benchmark constants, factory vs yaml vs SCORING_AUDIT
# ---------------------------------------------------------------------------
scorers = IndicatorScorerFactory()._scorers
ytxt = {}
for p in y["pillars"]:
    for s in p["subdomains"]:
        for i in s["indicators"]:
            ytxt[i["frontend_key"]] = " ".join(str(i.get("scoring")).split())


def f_params(sc):
    cls = type(sc).__name__
    d = {}
    for a in ("threshold", "global_average", "threshold_gap", "goal"):
        if hasattr(sc, a):
            d[a] = getattr(sc, a)
    return cls, d


def yaml_type(txt):
    t = txt.lower()
    if "100: country has a density" in t:
        return "DensityScorer"
    if "pre-normalized" in t and "simpledirectional" in t:
        return "SimpleDirectionalScorer"
    if "simpledirectionalscorer then flips" in t:
        return "SimpleDirectionalScorer"
    if "ratio of the country value to a goal" in t:
        return "GoalRatioScorer"
    if "inverse of score squared" in t:
        return "RatioGoalInverseScorer"
    if t.startswith("100 - original indicator"):
        return "InverseRatioScorer"
    if t.startswith("100 - index score"):
        return "SimpleDirectionalScorer"
    if "one minus the ratio" in t:
        return "RatioThresholdScorer"
    return "?"


def yaml_numbers(txt):
    t = re.sub(r"0, 100|0-1|0-100", " ", txt)
    return [float(x) for x in re.findall(r"(?<![\w.])(\d+(?:\.\d+)?)(?![\w])", t)]


bench_rows = []
disagree = []
for t in tax:
    k, sc_code = t.frontend_key, t.series_code
    sc = scorers.get(sc_code)
    cls, params = f_params(sc) if sc is not None else ("<none>", {})
    txt = ytxt[k]
    ytype = yaml_type(txt)
    nums = yaml_numbers(txt)
    notes = []
    if ytype != cls:
        notes.append(f"scorer type: yaml implies {ytype}, factory has {cls}")
    bench = params.get("threshold", params.get("threshold_gap", params.get("goal")))
    if cls not in ("SimpleDirectionalScorer", "DensityScorer") and bench is not None:
        # yaml number list contains the benchmark constant?
        if not any(abs(bench - n) < 1e-9 or abs(bench - n / 100.0) < 1e-9 for n in nums):
            notes.append(f"benchmark {bench} not among yaml numbers {nums}")
    ga = params.get("global_average")
    if "threshold" in params and ga is not None and abs(ga - params["threshold"]) > 1e-12:
        notes.append(f"threshold {params['threshold']} != global_average {ga}")
    if "global average" in txt.lower() and "threshold" in params and ga is None:
        notes.append("yaml harmonises below 'global average' but factory global_average is None "
                     "(clamp gives the same result only if the unstated global average equals the threshold)")
    bench_rows.append((k, sc_code, cls, params, ytype, nums, notes))
    if notes:
        disagree.append((k, notes))

# manual semantic notes the regexes cannot see
manual = {
    "renew": "yaml says 'goal of 20%' (a level of the renewable share). InverseRatioScorer(20.0) treats 20 as the allowed GAP, "
             "i.e. benchmark renewable share 80%. Every other InverseRatio indicator quotes the gap (water 27.1, sanit 43, "
             "elec 9.8, clean 30.4, finc 45). Unit mismatch unless 20 is intentionally a gap.",
    "contra": "yaml: 'global average of 11.5%' with '100 - original indicator'. InverseRatioScorer(11.5) uses 11.5 as the gap, "
              "i.e. benchmark value 88.5%. Whether 11.5 is a level or a gap is not stated in the yaml.",
    "susag": "yaml still describes the retired 1-5 band transform (inverse square, optimum 5 -> 0.04). Factory and SCORING_AUDIT row 13 "
             "use SimpleDirectionalScorer (100 - value) since the 2026-07-07 fix. yaml text was not updated.",
    "stunt": "yaml ends 'continuous variable of scale ~0-1' where sibling indicators say 'normalized to 0, 100'. Scorer output is 0-100.",
    "agoda": "yaml: values greater than the global average are harmonised to 0; factory GoalRatioScorer(goal=0.02) has no global_average. "
             "Under clamp, value above goal gives need 0 anyway only when global average equals goal.",
    "gii": "yaml calls 0.32 the 'min group value'; the other ratio indicators call it a global average. Factory has no global_average. Same numeric constant.",
}
for k, m in manual.items():
    disagree.append((k, ["MANUAL: " + m]))

# SCORING_AUDIT table vs factory
sa_rows = []
sa_text = open(ROOT / "indicators" / "SCORING_AUDIT.md").read()
for line in sa_text.splitlines():
    m = re.match(r"^\|\s*\d+\s*\|\s*(\w+)\s*\|[^|]*\|[^|]*\|\s*([\w.]+)\s*\|.*\|\s*(.*?)\s*\|$", line)
    if not m:
        continue
    fk, scode, note = m.group(1), m.group(2), m.group(3)
    mm = re.search(r"(SimpleDirectional|RatioThreshold|InverseRatio|GoalRatio|Banded)\w*\(?([\d.,\s]*)\)?", note)
    sa_rows.append((fk, scode, note, mm))
sa_notes = []
cls_alias = {"SimpleDirectional": "SimpleDirectionalScorer", "RatioThreshold": "RatioThresholdScorer",
             "InverseRatio": "InverseRatioScorer", "GoalRatio": "GoalRatioScorer", "Banded": "DensityScorer"}
for fk, scode, note, mm in sa_rows:
    sc = scorers.get(KEY2SERIES.get(fk))
    if sc is None:
        sa_notes.append((fk, f"SCORING_AUDIT row series {scode}: no factory scorer for {KEY2SERIES.get(fk)}"))
        continue
    cls, params = f_params(sc)
    if KEY2SERIES.get(fk) != scode:
        sa_notes.append((fk, f"series_code: SCORING_AUDIT {scode} vs taxonomy {KEY2SERIES.get(fk)}"))
    if mm:
        want = cls_alias[mm.group(1)]
        if want != cls:
            sa_notes.append((fk, f"scorer type: SCORING_AUDIT {mm.group(1)} vs factory {cls}"))
        nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", mm.group(2) or "")]
        fnums = [v for v in (params.get("threshold"), params.get("global_average"), params.get("threshold_gap"), params.get("goal")) if v is not None]
        if nums and not all(any(abs(n - f) < 1e-9 for f in fnums) for n in nums):
            sa_notes.append((fk, f"constants: SCORING_AUDIT {nums} vs factory {fnums}"))
    elif fk not in ("uhc", "ihr", "state", "mspi", "popdens"):
        sa_notes.append((fk, f"SCORING_AUDIT note has no parseable scorer: {note[:80]}"))
yaml_keys = set(KEYS)
audit_keys = {r[0] for r in sa_rows}
if yaml_keys != audit_keys:
    sa_notes.append(("table", f"SCORING_AUDIT direction table keys differ from yaml: yaml-only {sorted(yaml_keys - audit_keys)}, audit-only {sorted(audit_keys - yaml_keys)}"))
factory_extra = sorted(set(scorers) - {t.series_code for t in tax})
SA_IHR = "SCORING_AUDIT row 11 says IHR is 'class-code-weighted inside aggregation'; dimensions.py takes an unweighted mean over the 13 capacities before scoring."

# ---------------------------------------------------------------------------
# Write findings markdown
# ---------------------------------------------------------------------------
L: list[str] = []
w = L.append
w("# Consistency audit")
w("")
w(f"Run `{RUN_ID}`. Generated by `audit/derive_consistency.py`. Accounting table: `audit/results/consistency_accounting.csv`.")
w("")
w("## Headline")
w("")
if unexplained:
    w(f"**{len(unexplained)} unexplained gaps in record accounting** (stage-to-stage drops not covered by a countable reason):")
    w("")
    w("| indicator | series | stage | unexplained rows | total dropped |")
    w("|---|---|---|---:|---:|")
    for k, s, st, r, d in unexplained:
        w(f"| {k} | {s} | {st} | {r} | {d} |")
else:
    w("No unexplained drops: every row lost between stages is attributed to a counted reason, and the independent replica "
      "of cleaning and dimension selection reproduces the on-disk row counts.")
w("")
if agoda_nogdp_info:
    n = agoda_nogdp_info["n"]
    w(f"**agoda (DC_TOF_AGRL) GDP join leak.** {n} of {agoda_nogdp_info['of']} non-null harmonised rows have no NY.GDP.MKTP.CD > 0 "
      "for the same country-year. `_apply_agoda_gdp_normalization` only converts rows where the join succeeds "
      "(`work.loc[agoda_mask, 'value'] = agoda['value'].values` writes the unchanged USD-millions value back for the rest). "
      "Those rows are then scored by `GoalRatioScorer(goal=0.02)` as if the number were an ag-flow/GDP ratio, so need saturates at 100 and "
      "the dashboard shows 0.0.")
    fr = agoda_nogdp_info["frame"]
    pub100 = pub_other = pub_null = 0
    for r in fr.itertuples():
        if r.country_code in ts and int(r.year) in YEARS:
            v = ts[r.country_code]["agoda"][YEARS.index(int(r.year))]
            if v == 100:
                pub100 += 1
            elif v is None:
                pub_null += 1
            else:
                pub_other += 1
    w(f"Direction: ratio far above the 0.02 goal gives need 0, which the publish boundary shows as 100 (best). "
      f"Of the affected rows that fall on a published country-year, {pub100} are published as 100.0, {pub_other} as another value, "
      f"{pub_null} as null. A missing GDP therefore turns a data gap into a top score. "
      "Fix: set value to NaN where GDP is missing (or drop the row) instead of keeping the USD-millions value.")
    w("")
if conflict_info:
    w("**Conflicting duplicates left after dimension selection** (kept, not dropped; the publisher then takes the first): "
      + ", ".join(f"{k}: {v} rows" for k, v in conflict_info.items()))
    w("")
w("## Check 1: record accounting")
w("")
w("Stages: `raw_store` (records in data/store), `cleaned` (data/clean), `iso3_harmonized` (load_harmonized_interim), "
  "`dimension_selected` (select_dimensions, after the agoda GDP step and the mspi append), `scored_nonnull` "
  "(Indicator_Scores_Full rows with a score), `published_nonnull` (non-null country-years in timeseries.json).")
w("")
w("Independent expectations computed straight from the store for the raw-to-clean step; dimension reasons come from a replica of the "
  "documented rules and are checked against `select_dimensions` and against `Indicator_Scores_Full.csv` row counts. "
  "WB aggregate codes (AFE, WLD, ...) are 3 capital letters, so `resolve()` passes them through; they are only removed at publish, "
  "which is where they are counted.")
w("")
w("### Stage totals per indicator (final dimension: country-years)")
w("")
w("| key | series | raw | cleaned | iso3 | dims | scored | published |")
w("|---|---|---:|---:|---:|---:|---:|---:|")
for t in tax:
    k, s = t.frontend_key, t.series_code
    if k == "mspi":
        continue
    sub = acct_df[(acct_df.indicator_key == k) & (acct_df.series == s)].set_index("stage")["rows"]
    w(f"| {k} | {s} | {sub.get('raw_store','')} | {sub.get('cleaned','')} | {sub.get('iso3_harmonized','')} | "
      f"{sub.get('dimension_selected','')} | {sub.get('scored_nonnull','')} | {sub.get('published_nonnull','')} |")
sub = acct_df[(acct_df.indicator_key == "mspi") & (acct_df.series == MSPI_SERIES_CODE)].set_index("stage")["rows"]
w(f"| mspi | MSPI_INDEX | (13 component series, see CSV) | | | {sub.get('dimension_selected','')} | {sub.get('scored_nonnull','')} | {sub.get('published_nonnull','')} |")
w("")
w("### Every drop with its reason")
w("")
w("| key | series | stage | rows | dropped | reason |")
w("|---|---|---|---:|---:|---|")
for r in acct:
    if r["dropped_from_previous"] in ("", 0) and not r["reason"]:
        continue
    w(f"| {r['indicator_key']} | {r['series']} | {r['stage']} | {r['rows']} | {r['dropped_from_previous']} | {r['reason']} |")
w("")
w("### Codes removed at the publish boundary (not in the published country set)")
w("")
w("Rows summed over all indicators. A code in the WB metadata but not in country_codes.csv is a real economy that is never shown.")
w("")
w("| code | name | rows removed | in country_codes.csv | in WB country metadata |")
w("|---|---|---:|---|---|")
names = clean_all.dropna(subset=["country_code"]).drop_duplicates("country_code").set_index("country_code")["country_name"]
for c, n_c in sorted(publish_dropped_codes.items(), key=lambda x: -x[1]):
    w(f"| {c} | {names.get(c, '')} | {n_c} | {c in CODES} | {c in WBMETA} |")
w("")
if not conflict_info:
    w("Conflicting duplicate country-years left by dimension selection: 0 for every series (nothing for validation rule R1 to block, nothing the publisher resolves with `first`).")
    w("")
no_data = [c["iso3"] for c in countries if all(v is None for k in KEYS for v in ts[c["iso3"]][k])]
w(f"Countries published with every indicator null: {len(no_data)} {no_data[:20]}")
w("")

w("## Check 2: published files against each other")
w("")
w("| check | result | detail |")
w("|---|---|---|")
for n, st, d in c2:
    d = d.replace("|", "/").replace("\n", " ")
    w(f"| {n} | {st} | {d[:400]} |")
w("")
w("Zero counts per indicator (published exact 0.0): " + ", ".join(f"{k}={v}" for k, v in sorted(zero_ct.items(), key=lambda x: -x[1])))
w("")

w("## Check 3: benchmark constants")
w("")
w("Source of factory values: `src/calculating/factory.py`. Yaml values: `indicators/indicators.yaml` scoring text. "
  "Mode is `clamp`; in clamp mode `RatioThresholdScorer` and `GoalRatioScorer` apply `global_average` harmonisation, "
  "`InverseRatioScorer` always does.")
w("")
w("| key | series | factory scorer | factory constants | yaml implies | yaml numbers | disagreement |")
w("|---|---|---|---|---|---|---|")
for k, sc_code, cls, params, ytype, nums, notes in bench_rows:
    w(f"| {k} | {sc_code} | {cls} | {params or ''} | {ytype} | {nums} | {'; '.join(notes)} |")
w("")
w("### Disagreements, factory vs yaml")
w("")
for k, notes in disagree:
    for n in notes:
        w(f"- **{k}**: {n}")
w("")
w("### Disagreements, factory vs SCORING_AUDIT direction table")
w("")
if sa_notes:
    for k, n in sa_notes:
        w(f"- **{k}**: {n}")
else:
    w("- None.")
w(f"- **ihr**: {SA_IHR}")
w("")
w("### Factory entries with no taxonomy indicator")
w("")
w("- " + ", ".join(factory_extra) + " (HDI_INDEX is a verification baseline; POP_DENSITY is a legacy alias of EN.POP.DNST; "
  "the others are SDG series the taxonomy maps to another frontend key or not at all.)")
w("")
w("Note: all RatioThresholdScorer entries that pass `global_average` set it equal to `threshold`; the yaml never gives a separate global-average "
  "number, so no threshold-vs-global-average numeric conflict exists in the data, only the missing value for abr, gii, ndgain, mpi (global_average None).")
OUT_MD.write_text("\n".join(L) + "\n")

print(f"accounting rows: {len(acct_df)}  unexplained: {len(unexplained)}")
for u in unexplained:
    print("  UNEXPLAINED", u)
for n, st, d in c2:
    if st != "PASS":
        print(st, n, d[:300])
print("benchmark disagreements:", sum(len(n) for _, n in disagree), " audit notes:", len(sa_notes))
