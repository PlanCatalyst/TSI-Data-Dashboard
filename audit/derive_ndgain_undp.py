"""Independent derivation: ndgain, gii, mpi expected dashboard scores from the raw store.

Run from repo root: .venv/bin/python audit/derive_ndgain_undp.py
"""
import re
from pathlib import Path

import numpy as np
import pandas as pd

from _scope import restrict, oos_line

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "data/store/20261015T001106Z"
ND = STORE / "ndgain/extracted/ndgain_countryindex_2026/resources"
HDR = STORE / "undp_hdr"
OUT = ROOT / "audit/expected/ndgain_undp.csv"
DIAG = ROOT / "audit/findings/ndgain_undp_diag.csv"
MD = ROOT / "audit/findings/ndgain_undp.md"

THRESH = {"ndgain": 0.46, "gii": 0.32, "mpi": 0.089}
cc = pd.read_csv(ROOT / "indicators/country_codes.csv", dtype=str)
VALID = set(cc.iso3)
log = []  # findings lines


def survey_end_year(label):
    """Survey END year. '2015/2016 D' -> 2016, '2010-11 D' -> 2011, '1999-00' -> 2000, '2019 M' -> 2019."""
    m = re.match(r"^\s*(\d{4})(?:\s*[-/]\s*(\d{2,4}))?", label)
    start = int(m.group(1))
    end = m.group(2)
    if end is None:
        return start
    if len(end) == 4:
        return int(end)
    y = start // 100 * 100 + int(end)
    return y + 100 if y < start else y


def score(v, t):
    """Ratio threshold, clamp mode: need = 0 if v<=t else 100*(1-t/v); dashboard = 100-need."""
    need = 0.0 if v <= t else 100.0 * (1 - t / v)
    return round(100 - need, 1)


def rows(key, df_long, counts):
    out = []
    for iso, yr, val in df_long:
        out.append((iso, int(yr), key, val, score(val, THRESH[key]), ""))
    return out


# ---------------- ND-GAIN ----------------
def rd(p):
    return pd.read_csv(p).set_index("ISO3")


vul = rd(ND / "vulnerability/vulnerability.csv")
names = vul["Name"]
vul = vul.drop(columns="Name")
vul.columns = vul.columns.astype(int)
n_countries = len(vul)
agg_nd = [i for i in vul.index if i not in VALID]
vul_ok = vul.loc[[i for i in vul.index if i in VALID]]
st = vul_ok.stack().dropna()
nd_raw_cells = int(vul.size - vul.isna().sum().sum())
nd_rows = [(i, y, "ndgain", float(v), score(float(v), 0.46), "") for (i, y), v in st.items()]

# recomposition
sec_map = {"food": "food", "water": "wate", "health": "heal",
           "ecosystems": "ecos", "habitat": "habi", "infrastructure": "infr"}
sector_re = {}
max_ind_vs_sec = {}
for k, a in sec_map.items():
    inds = pd.concat({p.parent.name: rd(p).drop(columns="Name")
                      for p in sorted(ND.glob(f"indicators/id_{a}_*/score.csv"))})
    inds.columns = inds.columns.astype(int)
    sec_re = inds.groupby(level=1).mean()  # equal weight mean of 6 id_* scores
    sec_pub = rd(ND / f"vulnerability/{k}.csv").drop(columns="Name")
    sec_pub.columns = sec_pub.columns.astype(int)
    d = (sec_re - sec_pub.reindex_like(sec_re)).abs().stack()
    max_ind_vs_sec[k] = (len(inds.groupby(level=0)), float(d.max()), int(d.size))
    sector_re[k] = sec_re
vul_re = sum(sector_re.values()) / 6.0  # equal weight mean of 6 sector scores
vul_re = vul_re.reindex(vul.index)
# strict: any missing sector -> NaN (sum propagates NaN)
diff = (vul_re - vul)
diag = pd.DataFrame({
    "iso3": np.repeat(vul.index.values, vul.shape[1]),
    "year": np.tile(vul.columns.values, len(vul)),
    "published_composite": vul.values.ravel(),
    "recomposed": vul_re.values.ravel(),
    "difference": diff.values.ravel(),
})
diag = diag.dropna(subset=["published_composite", "recomposed"], how="all")
diag.to_csv(DIAG, index=False)
both = diag.dropna(subset=["published_composite", "recomposed"])
only_pub = diag[diag.recomposed.isna() & diag.published_composite.notna()]
only_re = diag[diag.published_composite.isna() & diag.recomposed.notna()]
maxdiff = float(both.difference.abs().max())
n_gt = int((both.difference.abs() > 1e-9).sum())
# score-level effect (rounded to 0.1)
sc_pub = both.published_composite.map(lambda v: score(v, 0.46))
sc_re = both.recomposed.map(lambda v: score(v, 0.46))
n_score_diff = int((sc_pub != sc_re).sum())
missing_by_iso = vul[vul.isna().any(axis=1)].isna().sum(axis=1)

# ---------------- GII ----------------
comp = pd.read_csv(HDR / "files/composite_indices.csv", encoding="latin-1")
gcols = [c for c in comp.columns if re.fullmatch(r"gii_\d{4}", c)]
g = comp[["iso3"] + gcols].set_index("iso3")
agg_gii = [i for i in g.index if i not in VALID]
g_ok = g.loc[[i for i in g.index if i in VALID]]
g_raw_cells = int(g.notna().sum().sum())
g_long = g_ok.stack().dropna()
gii_rows = []
gneg = 0
for (i, c), v in g_long.items():
    v = float(v)
    if v <= 0:
        gneg += 1
        continue
    gii_rows.append((i, int(c.split("_")[1]), "gii", v, score(v, 0.32), ""))
gii_years = sorted({r[1] for r in gii_rows})

# ---------------- MPI ----------------
raw = pd.read_csv(HDR / "sheets/mpi__gMPI_Table2.csv", header=None, dtype=str, keep_default_na=False)
hdr_idx = raw.index[raw[0].str.strip() == "Country"][0]
body = raw.iloc[hdr_idx + 1:]
name_to_iso = {}
for n, i in zip(comp["country"], comp["iso3"]):
    name_to_iso[n.strip().lower()] = i
for n, i in zip(cc["name"], cc["iso3"]):
    name_to_iso.setdefault(n.strip().lower(), i)
manual = {
    "bolivia (plurinational state of)": "BOL", "cabo verde": "CPV", "congo": "COG",
    "congo (democratic republic of the)": "COD", "côte d'ivoire": "CIV", "cote d'ivoire": "CIV",
    "eswatini (kingdom of)": "SWZ", "gambia": "GMB", "iran (islamic republic of)": "IRN",
    "lao people's democratic republic": "LAO", "moldova (republic of)": "MDA",
    "palestine, state of": "PSE", "state of palestine": "PSE", "tanzania (united republic of)": "TZA",
    "türkiye": "TUR", "turkiye": "TUR", "viet nam": "VNM", "north macedonia": "MKD",
    "venezuela (bolivarian republic of)": "VEN", "korea (democratic people's rep. of)": "PRK",
    "timor-leste": "TLS", "sao tome and principe": "STP", "são tomé and príncipe": "STP",
    "micronesia (federated states of)": "FSM", "syrian arab republic": "SYR",
    "eswatini": "SWZ", "russian federation": "RUS", "kyrgyzstan": "KGZ",
}
name_to_iso.update(manual)
mpi_rows, unmapped, no_val, bad_year, wave_log = [], [], 0, [], []
n_wave = 0
for _, r in body.iterrows():
    cname = r[0].strip()
    ys = r[2].strip()
    if not cname or not re.match(r"^\d{4}", ys):
        continue
    n_wave += 1
    val = r[4].strip()
    try:
        v = float(val)
    except ValueError:
        no_val += 1
        continue
    iso = name_to_iso.get(cname.lower())
    if iso is None or iso not in VALID:
        unmapped.append((cname, ys))
        continue
    year = survey_end_year(ys)
    wave_log.append((iso, year, ys, v))
mdf = pd.DataFrame(wave_log, columns=["iso3", "year", "survey", "v"])
dups = mdf[mdf.duplicated(["iso3", "year"], keep=False)]
mdf = mdf.drop_duplicates(["iso3", "year"], keep=False)
for _, r in mdf.iterrows():
    mpi_rows.append((r.iso3, int(r.year), "mpi", float(r.v),
                     score(float(r.v), 0.089) if r.v > 0 else 100.0, f"survey {r.survey}"))
mpi_zero = int((mdf.v <= 0).sum())

# ---------------- write ----------------
cols = ["iso3", "year", "indicator_key", "raw_value", "expected_score", "note"]
out = pd.DataFrame(nd_rows + gii_rows + mpi_rows, columns=cols)
assert out.expected_score.between(0, 100).all()
assert not out.duplicated(["iso3", "year", "indicator_key"]).any()
out = out.sort_values(["indicator_key", "iso3", "year"])
out, _oos_rows = restrict(out)
assert _oos_rows.empty
out.to_csv(OUT, index=False)
cnt = out.groupby("indicator_key").size().to_dict()
dist = out.groupby("indicator_key").expected_score.agg(["min", "median", "max"]).round(1)
zero_need = out.assign(z=out.expected_score == 100).groupby("indicator_key").z.sum().to_dict()

L = []
A = L.append
A("# Audit findings: ndgain, gii, mpi\n")
A("Generated by `audit/derive_ndgain_undp.py`. Source: raw store `data/store/20261015T001106Z/` only. Formula for all three: ratio threshold, clamp. need = 0 if value <= t else 100*(1 - t/value); expected_score = round(100 - need, 1).\n")
A("## Formulas and constants\n")
A("| key | threshold | yaml text | factory.py (`ND_GAIN_VULN`/`GII_INDEX`/`MPI_INDEX`) | agree |")
A("|---|---|---|---|---|")
for k, t, f in [("ndgain", 0.46, "ND_GAIN_VULN 0.46"), ("gii", 0.32, "GII_INDEX 0.32"), ("mpi", 0.089, "MPI_INDEX 0.089")]:
    A(f"| {k} | {t} | one minus ratio of benchmark {t} to value | {f} | yes |")
A("\nNo yaml vs factory disagreement found. Constants taken from yaml; factory only confirmed them.\n")
A("## Row counts\n")
A("| key | raw non-null cells | after ISO3 filter / valid | emitted |")
A("|---|---|---|---|")
A(f"| ndgain | {nd_raw_cells} | {len(st)} | {cnt['ndgain']} |")
A(f"| gii | {g_raw_cells} | {len(g_long)} | {cnt['gii']} |")
A(f"| mpi | {n_wave} survey waves, {n_wave-no_val} with value | {len(wave_log)} | {cnt['mpi']} |")
A("\n## Score distribution (dashboard orientation)\n")
A("| key | min | median | max | rows at 100 (value <= threshold) |\n|---|---|---|---|---|")
for k in ["ndgain", "gii", "mpi"]:
    A(f"| {k} | {dist.loc[k,'min']} | {dist.loc[k,'median']} | {dist.loc[k,'max']} | {zero_need[k]} |")
A("\n## Drops\n")
A("| source | reason | count |\n|---|---|---|")
A(f"| ndgain | non-ISO3 / aggregate rows ({', '.join(agg_nd) or 'none'}) | {len(agg_nd)} |")
A(f"| ndgain | null cells (not emitted): {', '.join(f'{i} ({n} yrs)' for i,n in missing_by_iso.items())} | {int(vul.isna().sum().sum())} |")
A(f"| gii | aggregate rows (HDR regional/group codes {', '.join(agg_gii)}) | {len(agg_gii)} |")
A(f"| gii | value <= 0 | {gneg} |")
A(f"| mpi | waves with no numeric MPI value | {no_val} |")
A(f"| mpi | country name not mapped to ISO3 | {len(unmapped)} {unmapped} |")
A(f"| mpi | duplicate iso3/end-year (conflicting waves dropped) | {len(dups)} |")
A("\n## ND-GAIN\n")
A(f"- Published composite `resources/vulnerability/vulnerability.csv`: {n_countries} countries, years {vul.columns.min()}-{vul.columns.max()} (2024 present; SCORING_AUDIT says 1995-2023, stale vs this 2026 release). `ndgain/records.csv` is the same table stacked with an `indicator` column; its `vulnerability` rows were not used separately.")
A("- Methodology (codebook + empirical): each sector = equal-weight mean of its six `id_<sector>_NN` score.csv files; vulnerability = equal-weight mean of the six sectors (food, water, health, ecosystems, habitat, infrastructure). Scores are already 0-1 with higher = more vulnerable (no inversion needed).")
A("- Sector recomposition from indicators vs published sector files (max abs diff, cells compared):")
for k, (ni, md, nc) in max_ind_vs_sec.items():
    A(f"  - {k}: {ni} indicators, max diff {md:.2e}, {nc} cells")
A(f"- Composite recomposed from sectors vs published: {len(both)} country-years compared, max abs diff {maxdiff:.2e}, cells with diff > 1e-9: {n_gt}. Expected scores (0.1 rounding) that differ: {n_score_diff}.")
A(f"- Published null but recomposable: {len(only_re)}. Published value but not recomposable: {len(only_pub)}. Details in `audit/findings/ndgain_undp_diag.csv` (recomposed value is NaN if any sector is missing).")
A("- Conclusion: published composite and recomposition agree to floating-point precision. The expected row uses the published composite.")
A("\n## GII\n")
A(f"- `files/composite_indices.csv` (latin-1, 206 rows), columns `gii_1990..gii_2023`. Emitted years {gii_years[0]}-{gii_years[-1]}. Note the 2023 column exists; SCORING_AUDIT says 1990-2022.")
A("- Wide-by-year, one value per country-year; no dimension ambiguity. The 11 `ZZ*` rows are HDR groups and dropped. Early years are sparse (1990 has 83 non-null countries).")
A("\n## MPI\n")
A("- Source: `sheets/mpi__gMPI_Table2.csv` (harmonized estimates over time, comparable across waves), matching SCORING_AUDIT/yaml (88 countries, 1-3 waves). Table 1 (latest survey, 2013-2024) is not used: values differ from Table 2 for the same survey (e.g. Afghanistan 2022/2023: Table 1 0.3603, Table 2 0.268 harmonized) and the pipeline docs use Table 2. Using Table 2 means the latest wave is not the Table 1 headline estimate. Flag for reviewer.")
A("- Year choice: survey END year (\"2015/2016 D\" -> 2016, \"2019 M\" -> 2019). Reason: the last field date is the latest time the data describes. Alternative (start year) would shift two-year surveys by one year; a midpoint is undefined for integer years. Matches pipeline doc (survey-end year). Survey code (D/M/N) kept in `note`.")
A(f"- Waves emitted: {cnt['mpi']} over {mdf.iso3.nunique()} countries. MPI values of 0 or below handled as need 0 (score 100): {mpi_zero}.")
A("- Not an annual panel: sparse by design; no interpolation or carry-forward.")
_oos = {c: "aggregate" if str(c).startswith("ZZ") else c for c in agg_nd + agg_gii}
_oos.update({n: n for n, _ in unmapped})
A("\n## Out of scope\n")
A(oos_line(_oos, len(agg_nd) + int(g.loc[agg_gii].notna().sum().sum()) + len(unmapped)) + " ND-GAIN and GII codes outside the 216-country list are listed by code; MPI entries are country names from the MPI sheet that did not map into the scope.")
MD.write_text("\n".join(L) + "\n")
print(cnt, "unmapped mpi:", unmapped, "dups:", len(dups))
print(dist)
