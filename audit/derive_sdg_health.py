"""Independent derivation of the 11 UN SDG health indicators (no pipeline imports)."""
import re
from pathlib import Path

import pandas as pd

from _scope import restrict, oos_line

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/store/20261015T001106Z/unsdg/records.csv"
OUT = ROOT / "audit/expected/sdg_health.csv"
FIND = ROOT / "audit/findings/sdg_health.md"
DIAG = ROOT / "audit/findings/sdg_health_diag.csv"

# key: (series, kind, constant, yaml/factory source)
SPEC = {
    "uhc": ("SH_ACS_UNHC_25", "direct", None),
    "tb": ("SH_TBS_INCD", "ratio", 40.0),
    "mal": ("SH_STA_MALR", "ratio", 10.0),
    "mmr": ("SH_STA_MORT", "ratio", 70.0),
    "u5mr": ("SH_DYN_MORT", "ratio", 25.0),
    "stunt": ("SH_STA_STNT", "ratio", 12.0),
    "maln": ("SN_STA_OVWGT", "ratio", 2.5),
    "anaem": ("SH_STA_ANEM", "ratio", 25.0),
    "contra": ("SH_FPL_MTMM", "inverse", 11.5),
    "abr": ("SP_DYN_ADKL", "ratio", 20.0),
    "ihr": ("SH_IHR_CAPS", "direct", None),
}
TOTALS = {"Location": {"ALLAREA"}, "Sex": {"BOTHSEX"}, "Quantile": {"_T"},
          "Age": {"ALLAGE"}, "Education level": {"_T"}}
DIMS = ["Location", "Reporting Type", "attributes.Nature", "attributes.Units", "Age",
        "Sex", "attributes.Observation Status", "Quantile", "Education level", "IHR Capacity"]


def need(kind, c, v):
    if kind == "direct":
        return 100.0 - v
    if kind == "ratio":
        return 0.0 if v <= c else 100.0 * (1 - c / v)
    gap = 100.0 - v
    return 0.0 if gap <= c else 100.0 * (1 - c / gap)


raw = pd.read_csv(RAW, low_memory=False, dtype=str)
cc = pd.read_csv(ROOT / "indicators/country_codes.csv", dtype=str)
cc["num"] = cc["iso_numeric"].str.lstrip("0")
num2iso = dict(zip(cc["num"], cc["iso3"]))

rows, diag, log = [], [], []
for key, (series, kind, const) in SPEC.items():
    g = raw[raw["series"] == series].copy()
    n_raw = len(g)
    g["v"] = pd.to_numeric(g["value"], errors="coerce")
    n_nonnum = int(g["v"].isna().sum())
    g = g[g["v"].notna()]
    multi = {d: sorted(g[d].fillna("<blank>").unique()) for d in DIMS if g[d].nunique(dropna=False) > 1}
    # dimension selection
    g = g.copy()
    dim_note = []
    for d, ok in TOTALS.items():
        vals = set(g[d].dropna())
        if vals and vals & ok:
            g = g[g[d].isna() | g[d].isin(ok)]
        elif vals:
            dim_note.append(f"{d} only {sorted(vals)} (no total; accepted as sole value)")
    if key == "abr":
        g = g[g["Age"] == "15-19"]
    n_dim = len(g)
    g["year"] = g["timePeriodStart"].astype(float).astype(int)
    g["code"] = g["geoAreaCode"].astype(float).astype(int).astype(str)
    g["iso3"] = g["code"].map(num2iso)
    unmapped = g[g["iso3"].isna()]
    agg = unmapped.groupby(["code", "geoAreaName"]).size().reset_index(name="n")
    g = g[g["iso3"].notna()]
    n_iso = len(g)
    conflicts = 0
    if key == "ihr":
        ncap = g.groupby(["iso3", "year"])["IHR Capacity"].nunique()
        short = int((ncap < 13).sum())
        grp = g.groupby(["iso3", "year"])["v"].mean().reset_index()
        grp["note"] = ncap.values.astype(int).astype(str)
        grp["note"] = "mean of " + grp["note"] + " capacities"
        dim_note.append(f"country-years with <13 capacities: {short}")
        res = grp
    else:
        res_l = []
        for (iso, yr), h in g.groupby(["iso3", "year"]):
            vals = h["v"].round(9).unique()
            if len(vals) == 1:
                res_l.append((iso, yr, float(vals[0]), "collapsed" if len(h) > 1 else ""))
            else:
                conflicts += 1
                diag.append((key, series, iso, yr, "conflict", ";".join(map(str, sorted(h["v"].unique()))),
                             ";".join(sorted(h["attributes.Nature"].fillna("<blank>").unique()))))
        res = pd.DataFrame(res_l, columns=["iso3", "year", "v", "note"])
    res["indicator_key"] = key
    res["raw_value"] = res["v"]
    res["expected_score"] = res["v"].apply(lambda v: round(100 - need(kind, const, v), 1))
    rows.append(res[["iso3", "year", "indicator_key", "raw_value", "expected_score", "note"]])
    log.append(dict(key=key, series=series, kind=kind, const=const, raw=n_raw, nonnum=n_nonnum,
                    dim=n_dim, iso=n_iso, emitted=len(res), conflicts=conflicts, agg=agg, multi=multi,
                    notes=dim_note, ymin=int(res.year.min()), ymax=int(res.year.max()),
                    nctry=res.iso3.nunique(),
                    outrange=int(((res.v < 0) | ((kind != "ratio") & (res.v > 100))).sum())))

out = pd.concat(rows).sort_values(["indicator_key", "iso3", "year"])
out, _oos_rows = restrict(out)
assert _oos_rows.empty
out.to_csv(OUT, index=False)
pd.DataFrame(diag, columns=["indicator_key", "series", "iso3", "year", "reason", "values", "natures"]).to_csv(DIAG, index=False)

L = ["# SDG health audit findings", "", "Raw: data/store/20261015T001106Z/unsdg/records.csv. Mode: clamp. "
     "Script: audit/derive_sdg_health.py.", "",
     "## Formulas and counts", "",
     "| key | series | formula | constant (source) | raw | non-numeric | after dims | after ISO3 | emitted | conflict drops | years | countries |",
     "|---|---|---|---|---|---|---|---|---|---|---|---|"]
for r in log:
    f = {"direct": "need = 100 - v (score = v)", "ratio": "need = 0 if v <= t else 100*(1-t/v)",
         "inverse": "gap=100-v; need = 0 if gap <= b else 100*(1-b/gap)"}[r["kind"]]
    c = "none (yaml: 100 - index)" if r["const"] is None else f"{r['const']} (yaml text and factory agree)"
    L.append(f"| {r['key']} | {r['series']} | {f} | {c} | {r['raw']} | {r['nonnum']} | {r['dim']} | {r['iso']} | "
             f"{r['emitted']} | {r['conflicts']} | {r['ymin']}-{r['ymax']} | {r['nctry']} |")
L += ["", "## Dimension columns with more than one value, and handling", ""]
for r in log:
    L.append(f"- {r['key']} ({r['series']}): " + ("; ".join(f"{d}={v}" for d, v in r["multi"].items()) or "none")
             + (". " + " ".join(r["notes"]) if r["notes"] else ""))
L += ["", "## Dropped non-country geographies (aggregates/regions, unmapped to ISO3)", "",
      "| key | rows dropped | distinct codes |", "|---|---|---|"]
for r in log:
    L.append(f"| {r['key']} | {int(r['agg'].n.sum()) if len(r['agg']) else 0} | {len(r['agg'])} |")
L += ["", "Unmapped codes and names (union):", ""]
u = pd.concat([r["agg"] for r in log]).drop_duplicates(["code"]).sort_values("code", key=lambda s: s.astype(int))
L.append(", ".join(f"{a} {b}" for a, b in zip(u.code, u.geoAreaName)))
_oosn = dict(zip(u.code, u.geoAreaName))
L += ["", "## Out of scope", "", oos_line(_oosn, int(sum(r["agg"].n.sum() for r in log)))]
L += ["", "## Conflict drops", "",
      "See audit/findings/sdg_health_diag.csv. Per key: " + ", ".join(f"{r['key']}={r['conflicts']}" for r in log),
      "", "## Sanity", "", f"- Rows: {len(out)}; duplicate (iso3,year,key): "
      f"{int(out.duplicated(['iso3','year','indicator_key']).sum())}; score range "
      f"{out.expected_score.min()} to {out.expected_score.max()}.",
      "", "## Ambiguities and observations", "",
      "- yaml says values below the global average are harmonized to 0; no global average numbers are given, "
      "so the threshold/benchmark is used as the clamp point (factory sets global_average = threshold). Same result as clamp.",
      "- contra yaml text: 100 - indicator, then 1 - 11.5/gap (the gap of unmet need), implemented as InverseRatio.",
      "- yaml 3.2.1 u5mr definition text is a copy of skilled birth attendance; scoring text (target 25) and series SH_DYN_MORT used.",
      "- yaml says stunt result is a continuous 0-1 scale; scored 0-100 as the other ratio indicators.",
      "- Series with only FEMALE sex (mmr, anaem, contra, abr) have no BOTHSEX row; the sole value is used.",
      "- uhc yaml cites no series code; SH_ACS_UNHC_25 (2025 methodology) is the only UHC series in the store.",
      "- Nature codes differ for mal (C, CA, M, E) and tb; leftovers with identical value are collapsed, conflicts dropped.",
      ]
FIND.write_text("\n".join(L) + "\n")
print(out.groupby("indicator_key").size().to_string())
