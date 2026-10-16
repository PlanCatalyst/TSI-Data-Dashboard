"""Independent derivation for popdens, state and mspi (World Bank sources).

Run from repo root: .venv/bin/python audit/derive_worldbank.py
Reads only the raw store. No pipeline imports.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from _scope import restrict, oos_line

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "data/store/20261015T001106Z"
OUT_CSV = ROOT / "audit/expected/worldbank.csv"
OUT_MD = ROOT / "audit/findings/worldbank.md"
OUT_DIAG = ROOT / "audit/findings/worldbank_diag.csv"

# WGI legacy codes that differ from World Bank metadata ids / ISO3
WGI_CODE_FIX = {"ADO": "AND", "ROM": "ROU", "TMP": "TLS", "ZAR": "COD", "KSV": "XKX"}

md = []
diag = []


def log(s=""):
    md.append(s)


# ---------------------------------------------------------------- metadata
meta = pd.read_csv(STORE / "wb_country_metadata/records.csv", dtype=str, keep_default_na=False)
agg_ids = set(meta.loc[meta["region.value"].str.strip() == "Aggregates", "id"])
country_ids = set(meta["id"]) - agg_ids
lending = dict(zip(meta["id"], meta["lendingType.id"]))
log("# World Bank audit findings (popdens, state, mspi)\n")
log(f"Country metadata: {len(meta)} rows, {len(agg_ids)} aggregates, {len(country_ids)} countries.\n")

# ---------------------------------------------------------------- records
rec = pd.read_csv(STORE / "worldbank/records.csv", dtype=str, keep_default_na=False)
rec["year"] = pd.to_numeric(rec["date"], errors="coerce")
rec["val"] = pd.to_numeric(rec["value"], errors="coerce")
rec["iso3"] = rec["countryiso3code"].where(rec["countryiso3code"] != "", rec["country.id"])
raw_counts = rec.groupby("indicator.id").size().to_dict()


def wb_series(code):
    d = rec[rec["indicator.id"] == code]
    n_raw = len(d)
    n_null = int(d["val"].isna().sum())
    d = d.dropna(subset=["val", "year"])
    is_country = d["iso3"].isin(country_ids)
    n_agg = int((~is_country).sum())
    d = d[is_country]
    dup = int(d.duplicated(["iso3", "year"]).sum())
    d = d.drop_duplicates(["iso3", "year"], keep=False) if dup else d
    s = d.set_index(["iso3", d["year"].astype(int)])["val"]
    s.index.names = ["iso3", "year"]
    stats = dict(raw=n_raw, null=n_null, aggregate_rows_dropped=n_agg, dup_dropped=dup, kept=len(s))
    return s, stats


rows = []

# ---------------------------------------------------------------- popdens
pd_s, pst = wb_series("EN.POP.DNST")


def dens_need(v):
    if v >= 250: return 100
    if v >= 100: return 75
    if v >= 75: return 50
    if v >= 25: return 25
    return 0


for (iso, yr), v in pd_s.items():
    rows.append((iso, yr, "popdens", v, round(100 - dens_need(v), 1), "band"))

# ---------------------------------------------------------------- WGI
def read_wgi(dim):
    f = pd.read_csv(STORE / f"wb_wgi/sheets/wgi_dataset__{dim}.csv", dtype=str, keep_default_na=False)
    return f


ge = read_wgi("ge")
est_col = [c for c in ge.columns if c.startswith("Governance estimate")][0]
score_col = [c for c in ge.columns if c.startswith("Governance score (0-100)")][0]
ge["iso_raw"] = ge["Economy (code)"]
ge["iso3"] = ge["iso_raw"].replace(WGI_CODE_FIX)
ge["year"] = pd.to_numeric(ge["Year"], errors="coerce")
ge["score"] = pd.to_numeric(ge[score_col], errors="coerce")
n_ge = len(ge)
n_ge_null = int(ge["score"].isna().sum())
ge_nonnull = ge.dropna(subset=["score", "year"])
not_country = ge_nonnull[~ge_nonnull["iso3"].isin(country_ids)]
ge_ok = ge_nonnull[ge_nonnull["iso3"].isin(country_ids)]
ge_dup = int(ge_ok.duplicated(["iso3", "year"]).sum())
unmatched_codes = sorted(set(not_country["iso_raw"]))
for _, r in ge_ok.iterrows():
    rows.append((r["iso3"], int(r["year"]), "state", r["score"], round(float(r["score"]), 1), "wgi_ge_score_0_100"))

# ---------------------------------------------------------------- mspi
dims = ["cc", "ge", "pv", "rl", "rq", "va"]
wg = {}
for d in dims:
    f = read_wgi(d)
    f["iso3"] = f["Economy (code)"].replace(WGI_CODE_FIX)
    f["year"] = pd.to_numeric(f["Year"], errors="coerce")
    f["est"] = pd.to_numeric(f[[c for c in f.columns if c.startswith("Governance estimate")][0]], errors="coerce")
    f = f.dropna(subset=["est", "year"])
    f = f[f["iso3"].isin(country_ids)]
    wg[d] = f.drop_duplicates(["iso3", "year"], keep=False).assign(year=lambda x: x["year"].astype(int)).set_index(["iso3", "year"])["est"]
wgi_df = pd.DataFrame(wg)
wgi_df["n_dims"] = wgi_df[dims].notna().sum(axis=1)
wgi_df["avg_wgi"] = wgi_df[dims].mean(axis=1, skipna=True)

series = {c: wb_series(c) for c in [
    "NY.GDP.PCAP.CD", "DT.DOD.PVLX.GN.ZS", "DT.DOD.PVLX.EX.ZS", "DT.DOD.DECT.GN.ZS",
    "DT.DOD.DECT.EX.ZS", "DT.TDS.DECT.EX.ZS", "DT.DOD.ALLC.ZS"]}
m = pd.DataFrame({k: v[0] for k, v in series.items()})
m.index.names = ["iso3", "year"]
m = m.join(wgi_df[["avg_wgi", "n_dims"]], how="outer")
m = m.reset_index()
m = m[m["iso3"].isin(country_ids)]

THR = {"weak": (30, 140, 10), "medium": (40, 180, 15), "strong": (55, 240, 21)}
LN_LO, LN_HI = np.log(200), np.log(150000)
drop_reasons = {}
mspi_in = 0


def drop(reason, key):
    drop_reasons.setdefault(reason, set()).add(key)


mspi_rows = []
for rec_ in m.to_dict("records"):
    key = (rec_["iso3"], rec_["year"])
    lt = lending.get(rec_["iso3"])
    inputs = [rec_[c] for c in ["NY.GDP.PCAP.CD", "DT.DOD.ALLC.ZS", "DT.TDS.DECT.EX.ZS",
                                "DT.DOD.PVLX.GN.ZS", "DT.DOD.DECT.GN.ZS"]] + [rec_["avg_wgi"]]
    if not any(pd.notna(x) for x in inputs):
        continue
    if lt not in ("IBD", "IDB", "IDX"):
        drop(f"out_of_scope lendingType={lt!r} (spec scope gate)", key)
        continue
    gdp, conc, ds, avg = rec_["NY.GDP.PCAP.CD"], rec_["DT.DOD.ALLC.ZS"], rec_["DT.TDS.DECT.EX.ZS"], rec_["avg_wgi"]
    miss = []
    if pd.isna(gdp) or gdp <= 0: miss.append("income")
    if pd.isna(avg): miss.append("fragility")
    if pd.isna(conc): miss.append("nonconcessional")
    pvg, pve = rec_["DT.DOD.PVLX.GN.ZS"], rec_["DT.DOD.PVLX.EX.ZS"]
    fvg, fve = rec_["DT.DOD.DECT.GN.ZS"], rec_["DT.DOD.DECT.EX.ZS"]
    basis = None
    if pd.notna(pvg) and pd.notna(pve):
        basis, vg, ve = "present_value", pvg, pve
    elif pd.isna(pvg) and pd.isna(pve) and pd.notna(fvg) and pd.notna(fve):
        basis, vg, ve = "face_value", fvg, fve
    elif pd.notna(pvg) != pd.notna(pve):
        drop("ambiguous: exactly one PV series present (spec silent on partial PV)", key)
        continue
    if basis is None: miss.append("debt_risk(no debt stock pair)")
    if pd.isna(ds): miss.append("debt_risk(no debt service)")
    if miss:
        drop("incomplete_data: " + ",".join(sorted(set(miss))), key)
        continue
    tier = "strong" if avg >= -0.20 else ("medium" if avg >= -0.80 else "weak")
    tg, te, td = THR[tier]
    mx = max(vg / tg, ve / te, ds / td)
    cat = "Low" if mx < 0.75 else ("Moderate" if mx < 1.0 else "High")
    n_debt = {"Low": 1.0, "Moderate": 0.5, "High": 0.0}[cat]
    n_inc = float(np.clip((np.log(gdp) - LN_LO) / (LN_HI - LN_LO), 0, 1))
    n_frag = float(np.clip((avg + 2.5) / 5.0, 0, 1))
    n_non = 1 - float(np.clip((100 - conc) / 100, 0, 1))
    comp = 100 * 0.25 * (n_inc + n_frag + n_debt + n_non)
    comp = float(np.clip(comp, 0, 100))
    mspi_rows.append((rec_["iso3"], int(rec_["year"]), "mspi", comp, round(comp, 1), f"{basis};{tier};{cat}"))
    diag.append(dict(iso3=rec_["iso3"], year=int(rec_["year"]), n_inc=n_inc, n_frag=n_frag, n_debt=n_debt,
                     n_non=n_non, avg_wgi=avg, n_dims=rec_["n_dims"], tier=tier, max_ratio=mx, category=cat,
                     debt_basis=basis, composite=comp))
rows += mspi_rows

# ---------------------------------------------------------------- output
out = pd.DataFrame(rows, columns=["iso3", "year", "indicator_key", "raw_value", "expected_score", "note"])
assert out["expected_score"].between(0, 100).all(), "score out of range"
assert not out.duplicated(["iso3", "year", "indicator_key"]).any(), "duplicates"
out = out.sort_values(["indicator_key", "iso3", "year"])
out, _oos = restrict(out)
_mname = dict(zip(meta["id"], meta["name"]))
_oos_names = {c: _mname.get(c, c) for c in sorted(_oos["iso3"].unique())}
out.to_csv(OUT_CSV, index=False)
pd.DataFrame(diag).to_csv(OUT_DIAG, index=False)

counts = out.groupby("indicator_key").size().to_dict()
log("## Row counts\n")
log("| indicator | emitted |\n|---|---|")
for k, v in counts.items():
    log(f"| {k} | {v} |")

log("\n## popdens (EN.POP.DNST)\n")
log("Formula (yaml, same bands in factory DensityScorer, no disagreement): need = 100 if v>=250; 75 if >=100; 50 if >=75; 25 if >=25; else 0. expected_score = 100 - need.\n")
log(f"Records {pst['raw']}; null value {pst['null']}; aggregate rows dropped {pst['aggregate_rows_dropped']}; duplicate country-year dropped {pst['dup_dropped']}; emitted {counts.get('popdens', 0)}.")
log("Band edges are inclusive at the lower bound, matching yaml text. Yaml header says '31 reporting, only missing Palestine' which does not describe this fetch (all years, ~200 countries); stale text.\n")

log("## state (WGI Government Effectiveness)\n")
log(f"Yaml and SCORING_AUDIT row 24 say: use the pre-normalised 0-100 `{score_col}` column from the ge sheet, SimpleDirectional. factory WGI_GOVEFF is SimpleDirectionalScorer. No ambiguity on column choice: score (percentile rank) column, NOT the estimate. expected_score = value.\n")
log(f"ge sheet rows {n_ge}; null score {n_ge_null}; non-country codes dropped {len(not_country)} ({', '.join(unmatched_codes) or 'none'}); duplicate iso3-year {ge_dup}; emitted {counts.get('state', 0)}.")
log(f"WGI legacy code remaps applied: {WGI_CODE_FIX}. Remapped codes only count if the target is in WB metadata countries.\n")

log("## mspi (composite)\n")
log("Implemented per docs/spec-macrosec-index.md: income = clip((ln gdp - ln200)/(ln150000-ln200)); fragility = clip((mean of available WGI EST + 2.5)/5); debt tier cutoffs -0.20/-0.80; LIC-DSF thresholds weak 30/140/10, medium 40/180/15, strong 55/240/21; max ratio bins 0.75/1.0; score map 1/0.5/0; nonconcessional = 1 - clip((100-conc)/100) (= conc/100); composite = 100 * mean of four. expected_score = composite (spec is higher_is_better; pipeline inverts then publish re-inverts).")
log("Same-year alignment for all inputs (no carry-forward; spec silent). Scope gate: lendingType in IBD/IDB/IDX from WB metadata (current-state). The unapproved high-income refinement is NOT applied.\n")
log("Choices made where spec is ambiguous (all conservative, drop rather than guess):")
log("- PV used only if both PV GN and PV EX present; face value only if both PV absent and both face present; exactly one PV present is dropped.")
log("- Debt service missing: dropped (max over a partial ratio set would silently understate risk).")
log("- WGI average uses any 1 to 6 available dimensions as the spec says 'skip missing, average present'; min count not specified. n_dims in diag csv; see distribution below.")
log("- Income <= 0 treated as missing (log undefined); none expected.")
log("- Spec 'index_version 1.0' vs yaml 1.1: cosmetic, no formula difference found.\n")
nd = pd.DataFrame(diag)
if len(nd):
    log("WGI dimensions available among emitted mspi rows: " + ", ".join(f"{int(k)} dims: {v}" for k, v in nd["n_dims"].value_counts().sort_index().items()))
    log("Debt basis: " + ", ".join(f"{k}: {v}" for k, v in nd["debt_basis"].value_counts().items()))
    log("Category: " + ", ".join(f"{k}: {v}" for k, v in nd["category"].value_counts().items()) + "\n")
log("Drops (distinct country-years; only years where at least one mspi input existed):\n")
log("| reason | country-years | countries |\n|---|---|---|")
for k, v in sorted(drop_reasons.items(), key=lambda kv: -len(kv[1])):
    log(f"| {k} | {len(v)} | {len({i for i, _ in v})} |")
log("")
oos = sorted({i for k, v in drop_reasons.items() if k.startswith("out_of_scope") for i, _ in v})
log(f"Out-of-scope countries that had at least one mspi input (count {len(oos)}): {' '.join(oos)}\n")

log("## Data oddities\n")
for code in ["NY.GDP.PCAP.CD", "DT.DOD.ALLC.ZS", "DT.DOD.PVLX.GN.ZS", "DT.TDS.DECT.EX.ZS"]:
    s = series[code][0]
    log(f"- {code}: kept {len(s)}, min {s.min():.3g}, max {s.max():.3g}, stats {series[code][1]}")
neg = (series["DT.DOD.ALLC.ZS"][0].lt(0) | series["DT.DOD.ALLC.ZS"][0].gt(100)).sum()
log(f"- DT.DOD.ALLC.ZS outside [0,100]: {int(neg)}")
log("\n## Out of scope\n")
log(oos_line(_oos_names, len(_oos), extra_aggregates=len(agg_ids)) + " Aggregate count here is the World Bank metadata aggregates (dropped before scoring); the codes listed above are non-aggregate economies that were scored by the audit and then removed by the scope filter. Rows removed by indicator: " + (", ".join(f"{k} {v}" for k, v in _oos.groupby("indicator_key").size().items()) or "none") + ".")
OUT_MD.write_text("\n".join(md) + "\n")
print(OUT_CSV, counts)
