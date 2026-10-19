"""Independent derivation: UN SDG non-health indicators.

Run from repo root: .venv/bin/python audit/derive_sdg_other.py
Reads only data/store/20261015T001106Z/{unsdg,worldbank}/records.csv and
indicators/country_codes.csv. No pipeline imports.
"""
import pandas as pd

from _scope import restrict, oos_line
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "data/store/20261015T001106Z"
OUT_CSV = ROOT / "audit/expected/sdg_other.csv"
OUT_MD = ROOT / "audit/findings/sdg_other.md"
OUT_DIAG = ROOT / "audit/findings/sdg_other_diag.csv"

# key: (series, kind, constant, source of constant)
SPEC = {
    "food": ("AG_PRD_FIESMS", "ratio", 20.0, "yaml (IPC threshold 20%); factory 20.0 agrees"),
    "susag": ("AG_LND_SUST", "simple", None, "SCORING_AUDIT + factory (SimpleDirectional); yaml text says 1-5 band, disagrees"),
    "agoda": ("DC_TOF_AGRL", "goal", 0.02, "yaml (goal 2% of GDP); factory 0.02 agrees"),
    "water": ("SH_H2O_SAFE", "inverse", 27.1, "yaml 27.1; factory agrees"),
    "sanit": ("SH_SAN_SAFE", "inverse", 43.0, "yaml 43; factory agrees"),
    "washmort": ("SH_STA_WASHARI", "ratio", 10.0, "yaml 10; factory agrees"),
    "elec": ("EG_ACS_ELEC", "inverse", 9.8, "yaml 9.8; factory agrees"),
    "clean": ("EG_EGY_CLEAN", "inverse", 30.4, "yaml 30.4; factory agrees"),
    "renew": ("EG_FEC_RNEW", "relative", 20.0, "framework 2026-10-16: goal 20%; factory agrees"),
    "finc": ("FB_BNK_ACCSS", "inverse", 45.0, "yaml 45; factory agrees"),
    "pov": ("SI_POV_NAHC", "ratio", 10.0, "yaml 10; factory agrees"),
}
TOTALS = {"Location": "ALLAREA", "Sex": "BOTHSEX", "Quantile": "_T",
          "Age": "ALLAGE", "Education level": "_T"}
OVERRIDE = {"finc": {"Age": "15+"}}
EXTRA_DIMS = ["Reporting Type", "attributes.Nature", "attributes.Units"]


def need(kind, v, c):
    if kind == "simple":
        return 100 - v
    if kind == "ratio":
        return np.where(v <= c, 0.0, 100 * (1 - c / np.where(v == 0, np.nan, v)))
    if kind == "relative":
        # 2026-10-16 framework: 1 - c/v, 0 below c, best value in the batch = 100.
        gain = np.where(v < c, 0.0, np.clip(1 - c / np.where(v == 0, np.nan, v), 0, None))
        return 100 - 100 * gain / np.nanmax(gain)
    if kind == "inverse":
        gap = 100 - v
        return np.where(gap <= c, 0.0, 100 * (1 - c / np.where(gap == 0, np.nan, gap)))
    raise ValueError(kind)


cc = pd.read_csv(ROOT / "indicators/country_codes.csv", dtype=str)
num2iso = {int(r.iso_numeric): r.iso3 for r in cc.itertuples()}
valid_iso = set(cc.iso3)

d = pd.read_csv(STORE / "unsdg/records.csv", low_memory=False, dtype=str)
rows, md, diag = [], [], []
oos_names, oos_rows_n = {}, 0

for key, (series, kind, c, src) in SPEC.items():
    x = d[d.series == series].copy()
    st = {"raw": len(x)}
    multi = {col: x[col].fillna("<blank>").value_counts().to_dict()
             for col in list(TOTALS) + EXTRA_DIMS + ["Age"] if col in x.columns
             and x[col].fillna("<blank>").nunique() > 1}
    for col, tot in {**TOTALS, **OVERRIDE.get(key, {})}.items():
        x = x[x[col].isna() | (x[col] == tot)]
    st["dims"] = len(x)
    x["value"] = pd.to_numeric(x["value"], errors="coerce")
    st["null_value"] = int(x.value.isna().sum())
    x = x.dropna(subset=["value"])
    x["year"] = x.timePeriodStart.astype(float).astype(int)
    x["code"] = x.geoAreaCode.astype(int)
    x["iso3"] = x.code.map(num2iso)
    oos_rows_n += int(x.iso3.isna().sum())
    oos_names.update(dict(zip(x.loc[x.iso3.isna(), "code"], x.loc[x.iso3.isna(), "geoAreaName"])))
    st["nonc"] = int(x.iso3.isna().sum())
    st["nonc_codes"] = x.loc[x.iso3.isna(), "code"].nunique()
    x = x.dropna(subset=["iso3"])
    st["mapped"] = len(x)
    # collapse identical duplicates, drop conflicting
    g = x.groupby(["iso3", "year"]).value.agg(["nunique", "first", "count"]).reset_index()
    conflict = g[g["nunique"] > 1]
    st["dup_collapsed"] = int(((g["count"] > 1) & (g["nunique"] == 1)).sum())
    st["conflict"] = len(conflict)
    for r in conflict.itertuples():
        vals = sorted(x[(x.iso3 == r.iso3) & (x.year == r.year)].value.unique())
        diag.append(dict(indicator_key=key, iso3=r.iso3, year=r.year, issue="conflict_dropped", detail=str(vals)))
    g = g[g["nunique"] == 1].rename(columns={"first": "raw_value"})[["iso3", "year", "raw_value"]]
    g["note"] = ""
    if kind == "goal":
        w = pd.read_csv(STORE / "worldbank/records.csv", dtype=str)
        w = w[w["indicator.id"] == "NY.GDP.MKTP.CD"].copy()
        w["gdp"] = pd.to_numeric(w.value, errors="coerce")
        w["year"] = w.date.astype(int)
        w = w.rename(columns={"countryiso3code": "iso3"})[["iso3", "year", "gdp"]]
        g = g.merge(w, on=["iso3", "year"], how="left")
        bad = g[~(g.gdp > 0)]
        st["gdp_missing"] = len(bad)
        for r in bad.itertuples():
            diag.append(dict(indicator_key=key, iso3=r.iso3, year=r.year, issue="no_gdp_dropped", detail=str(r.raw_value)))
        g = g[g.gdp > 0].copy()
        g["share"] = g.raw_value * 1e6 / g.gdp
        ratio = g.share / c
        n = np.clip(100 * (1 - ratio), 0, None)  # better than goal -> 0
        st["negative_flow"] = int((g.raw_value < 0).sum())
        for r in g[g.raw_value < 0].itertuples():
            diag.append(dict(indicator_key=key, iso3=r.iso3, year=r.year, issue="negative_flow", detail=str(r.raw_value)))
        g["note"] = ["share_of_gdp=%.6f" % s for s in g.share]
    else:
        n = need(kind, g.raw_value.values.astype(float), c)
    g["need"] = n
    g["expected_score"] = np.round(100 - np.clip(g["need"], 0, 100), 1)
    g["indicator_key"] = key
    st["emitted"] = len(g)
    st["multi"] = multi
    st["zero_need"] = int((g.need <= 0).sum())
    rows.append(g[["iso3", "year", "indicator_key", "raw_value", "expected_score", "note"]])
    md.append((key, series, kind, c, src, st, g))

out = pd.concat(rows).sort_values(["indicator_key", "iso3", "year"])
out, _oos_rows = restrict(out)
assert _oos_rows.empty
assert out.expected_score.between(0, 100).all()
assert not out.duplicated(["iso3", "year", "indicator_key"]).any()
out.to_csv(OUT_CSV, index=False)
pd.DataFrame(diag, columns=["indicator_key", "iso3", "year", "issue", "detail"]).to_csv(OUT_DIAG, index=False)

L = ["# SDG non-health audit findings", "",
     "Raw store: data/store/20261015T001106Z (unsdg, worldbank). Scoring mode clamp. "
     "expected_score = round(100 - need, 1), need clipped to [0,100].", "",
     "## Per indicator", "",
     "| key | series | formula | constant | constant source | raw | after dims | null value | non-country dropped | emitted | conflict drops | identical dups collapsed | need=0 rows |",
     "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
names = {"relative": "gain=0 if v<c else 1-c/v; need=100-100*gain/max(gain)", "ratio": "need=0 if v<=t else 100*(1-t/v)", "inverse": "gap=100-v; need=0 if gap<=b else 100*(1-b/gap)",
         "simple": "need=100-v (score=v)", "goal": "share=value*1e6/GDP; need=max(0,100*(1-share/0.02))"}
for key, series, kind, c, src, st, g in md:
    L.append(f"| {key} | {series} | {names[kind]} | {c} | {src} | {st['raw']} | {st['dims']} | {st['null_value']} | "
             f"{st['nonc']} rows / {st['nonc_codes']} codes | {st['emitted']} | {st['conflict']} | {st['dup_collapsed']} | {st['zero_need']} |")
L += ["", "Dimension filters applied (blank also accepted): " + ", ".join(f"{k}={v}" for k, v in TOTALS.items())
      + "; finc overrides Age=15+.", "", "## Dimension columns with more than one value in the raw series", ""]
for key, series, kind, c, src, st, g in md:
    L.append(f"- {key} ({series}): " + (str(st["multi"]) if st["multi"] else "none"))
L += ["", "Reading: food keeps Age=ALLAGE/BOTHSEX (the 15+ rows are sex-split only and fall out). water, sanit, elec, clean "
      "keep ALLAREA (URBAN/RURAL dropped). pov keeps ALLAREA (9 URBAN rows dropped). finc keeps Age 15+, BOTHSEX, ALLAREA, _T, _T. "
      "Nature, Reporting Type, Units varied only as shown; after the total filters no country-year had conflicting values "
      "unless listed in the conflict column and sdg_other_diag.csv.", "",
      "## agoda normalization", ""]
a = [m for m in md if m[0] == "agoda"][0]
L += [f"- SDG series DC_TOF_AGRL, Units column CON_USD_M (millions of constant 2022 USD). Multiplied by 1e6 to get USD.",
      "- GDP: worldbank NY.GDP.MKTP.CD (current USD), joined on iso3 and same year. share = value*1e6/GDP.",
      "- Goal ratio per yaml: need = 100*(1 - share/0.02); better than goal (share >= 2%) -> need 0 (clamp). SCORING_AUDIT: GoalRatioScorer compares value/goal.",
      f"- Dropped for missing or non-positive GDP: {a[5].get('gdp_missing')}. Negative raw flows: {a[5].get('negative_flow')} (need would exceed 100, clipped to 100, score 0; listed in diag csv).",
      "- Ambiguity: numerator is constant 2022 USD, denominator is current USD. Spec says only 'normalized to country GDP'; mixed price bases not adjusted here.",
      "", "## susag scale", ""]
s = [m for m in md if m[0] == "susag"][0][6]
L += [f"- Raw values range {s.raw_value.min()} to {s.raw_value.max()} (Units PERCENT), so the series is a 0-100 proportion, not the 1-5 band the yaml describes.",
      "- Disagreement: yaml scoring text for susag (inverse of score squared, optimum 5 = 0.04) is for a 1-5 band. factory.py and SCORING_AUDIT use SimpleDirectional (100 - value). This script follows factory/SCORING_AUDIT because the raw scale is 0-100; the yaml text is stale. "
      f"Only {len(s)} country-years exist ({s.iso3.nunique()} countries, years 2020-2024 only; 30 of 50 raw rows have null value).",
      "", "## Other observations", "",
      "- All series use geoAreaCode mapped via indicators/country_codes.csv (numeric M49 to ISO3); codes not in it are regions/aggregates or unmapped territories and are counted above in the non-country column.",
      "- yaml vs factory constants: no numeric disagreement; only the susag scoring text noted above.",
      "- yaml scoring text for every ratio/inverse indicator also says values better than the 'global average' are harmonized to 0, which is the clamp rule used here.",
      "- washmort max raw is 108.06 per 100,000 and pov min 0.0 (need 0, score 100)."]
L += ["", "## Out of scope", "", oos_line(oos_names, oos_rows_n)]
OUT_MD.write_text("\n".join(L) + "\n")
print(out.groupby("indicator_key").size())
print(len(diag), "diag rows")
