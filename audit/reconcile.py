"""Reconcile independent expectations against the published dashboard data.

    python3 audit/reconcile.py

No imports from src/. Reads audit/expected/*.csv and dashboard/public/v1/.
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = ROOT / "audit" / "expected"
RESULTS = ROOT / "audit" / "results"
PUBLIC = ROOT / "dashboard" / "public" / "v1"
TOL = 0.15


def load_dashboard():
    meta = json.loads((PUBLIC / "meta.json").read_text())
    ts = json.loads((PUBLIC / "timeseries.json").read_text())
    countries = json.loads((PUBLIC / "countries.json").read_text())
    rows = countries["countries"] if isinstance(countries, dict) else countries
    return meta, ts, {r["iso3"]: r for r in rows}


def main() -> int:
    meta, ts, countries = load_dashboard()
    years = meta["years"]
    yidx = {y: i for i, y in enumerate(years)}
    frames = []
    for p in sorted(EXPECTED.glob("*.csv")):
        df = pd.read_csv(p)
        df["source"] = p.stem
        frames.append(df)
    if not frames:
        print("no expected CSVs in audit/expected/")
        return 1
    exp = pd.concat(frames, ignore_index=True)
    exp["year"] = exp["year"].astype(int)

    records = []
    seen = set()
    for r in exp.itertuples(index=False):
        pub_series = ts.get(r.iso3, {}).get(r.indicator_key)
        pub = pub_series[yidx[r.year]] if (pub_series is not None and r.year in yidx) else None
        seen.add((r.iso3, r.indicator_key, r.year))
        e = None if pd.isna(r.expected_score) else float(r.expected_score)
        if e is None and pub is None:
            cls = "match_null"
        elif e is None:
            cls = "extra_in_dashboard"
        elif pub is None:
            cls = "missing_in_dashboard"
        elif abs(e - pub) <= TOL:
            cls = "match"
        else:
            cls = "mismatch"
        records.append((r.source, r.indicator_key, r.iso3, r.year, r.raw_value, e, pub, cls, getattr(r, "note", "")))
    # dashboard values with no expectation for that year, for every audited
    # indicator. Checking only (iso3, indicator) pairs with some expected row
    # hid countries the audit dropped entirely (PRK agoda, 25 years at 100).
    audited_keys = set(exp["indicator_key"])
    covered = {(i, k) for (i, k, _) in seen}
    for iso3, series in ts.items():
        for key, arr in series.items():
            if key not in audited_keys:
                continue
            note = "no expected row" if (iso3, key) in covered else "no expected row for this country"
            for y, v in zip(years, arr):
                if v is not None and (iso3, key, y) not in seen:
                    records.append(("dashboard", key, iso3, y, None, None, v, "extra_in_dashboard", note))
    res = pd.DataFrame(records, columns=["source", "indicator_key", "iso3", "year", "raw_value", "expected", "published", "class", "note"])
    RESULTS.mkdir(exist_ok=True)
    res[res["class"] != "match"].sort_values(["indicator_key", "iso3", "year"]).to_csv(RESULTS / "mismatches.csv", index=False)

    lines = ["# Reconciliation summary", "", f"Expected rows: {len(exp)}. Tolerance {TOL}.", ""]
    summary = res.groupby(["indicator_key", "class"]).size().unstack(fill_value=0)
    for c in ("match", "mismatch", "missing_in_dashboard", "extra_in_dashboard", "match_null"):
        if c not in summary:
            summary[c] = 0
    summary = summary[["match", "mismatch", "missing_in_dashboard", "extra_in_dashboard", "match_null"]]
    summary["agreement"] = (summary["match"] / (summary["match"] + summary["mismatch"]).clip(lower=1) * 100).round(1)
    lines.append("| Indicator | Match | Mismatch | Missing in dashboard | Extra in dashboard | Agreement |")
    lines.append("|---|---:|---:|---:|---:|---:|")
    for key, r in summary.sort_values("agreement").iterrows():
        lines.append(f"| `{key}` | {r['match']} | {r['mismatch']} | {r['missing_in_dashboard']} | {r['extra_in_dashboard']} | {r['agreement']}% |")
    totals = Counter(res["class"])
    lines += ["", f"Totals: {dict(totals)}", ""]
    # indicators the audit did not cover
    audited = set(exp["indicator_key"])
    missing = [i["key"] for i in meta["indicators"] if i["key"] not in audited]
    lines.append(f"Not covered by any expectation file: {', '.join(missing) if missing else 'none'}")
    # mismatch magnitude
    mm = res[res["class"] == "mismatch"]
    if len(mm):
        d = (mm["expected"] - mm["published"]).abs()
        lines += ["", f"Mismatch magnitude: median {d.median():.1f}, p90 {d.quantile(0.9):.1f}, max {d.max():.1f}"]
        worst = mm.assign(delta=d).sort_values("delta", ascending=False).head(15)
        lines += ["", "| Indicator | Country | Year | Raw | Expected | Published | Delta |", "|---|---|---:|---:|---:|---:|---:|"]
        for r in worst.itertuples():
            lines.append(f"| `{r.indicator_key}` | {r.iso3} | {r.year} | {r.raw_value} | {r.expected} | {r.published} | {r.delta:.1f} |")
    (RESULTS / "summary.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
