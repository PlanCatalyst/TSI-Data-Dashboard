"""Benchmark clamp audit (requirements v2, A3 and AC1.1).

Reads the scored indicator table and reports, per indicator, how many
country-years are pinned at the benchmark floor and how many countries show
ten or more consecutive identical scores while their source values change.

Run from the repo root after a scoring run:

    python3 scripts/clamp_audit.py                 # markdown table to stdout
    python3 scripts/clamp_audit.py --write-audit   # also refresh the section
                                                    # in indicators/SCORING_AUDIT.md
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SCORED = ROOT / "data" / "interim" / "validated" / "Indicator_Scores_Full.csv"
AUDIT = ROOT / "indicators" / "SCORING_AUDIT.md"
SECTION = "## Benchmark clamp audit"
RUN_LENGTH = 10


def flat_runs(group: pd.DataFrame) -> int:
    """Countries with >= RUN_LENGTH consecutive identical scores whose source
    values are not all identical over the same span (AC1.1)."""
    hits = 0
    for _, g in group.groupby("country_name"):
        g = g.sort_values("year")
        scores = g["score"].to_numpy()
        values = g["value"].to_numpy()
        start = 0
        for i in range(1, len(scores) + 1):
            if i == len(scores) or scores[i] != scores[start]:
                if i - start >= RUN_LENGTH and len(set(values[start:i])) > 1:
                    hits += 1
                    break
                start = i
    return hits


def audit(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for code, g in df.groupby("series_code"):
        g = g[g["value"].notna()]
        if g.empty:
            continue
        pinned = int(g["floored_to_zero"].sum()) if "floored_to_zero" in g else int((g["score"] == 0).sum())
        rows.append(
            {
                "indicator": code,
                "country_years": len(g),
                "pinned_at_floor": pinned,
                "pinned_share": round(100 * pinned / len(g), 1),
                "countries_flat_10y": flat_runs(g),
            }
        )
    return pd.DataFrame(rows).sort_values("pinned_share", ascending=False)


def to_markdown(table: pd.DataFrame) -> str:
    head = "| Indicator | Country-years | Pinned at floor | Share | Countries flat 10+ years |\n|---|---:|---:|---:|---:|"
    body = "\n".join(
        f"| `{r.indicator}` | {r.country_years} | {r.pinned_at_floor} | {r.pinned_share}% | {r.countries_flat_10y} |"
        for r in table.itertuples()
    )
    return f"{head}\n{body}"


def write_section(markdown: str, mode: str) -> None:
    text = AUDIT.read_text(encoding="utf-8")
    block = (
        f"{SECTION}\n\n"
        f"Generated {date.today().isoformat()} by `scripts/clamp_audit.py` with "
        f"`scoring.below_benchmark: {mode}`. A pinned row is a real source value "
        f"scored at the floor (need 0, dashboard 100) because the country is "
        f"already better than the client benchmark. The last column counts "
        f"countries whose score sits unchanged for ten or more consecutive years "
        f"while the source value moves (requirements v2, AC1.1). Re-run after "
        f"any scorer change.\n\n{markdown}\n"
    )
    pattern = re.compile(rf"{re.escape(SECTION)}.*?(?=\n## |\Z)", re.S)
    text = pattern.sub(block.rstrip("\n") + "\n", text) if pattern.search(text) else text.rstrip("\n") + "\n\n" + block
    AUDIT.write_text(text, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scored", type=Path, default=SCORED)
    ap.add_argument("--write-audit", action="store_true")
    ap.add_argument("--mode", default=None, help="label for the active scoring.below_benchmark")
    args = ap.parse_args()
    if not args.scored.exists():
        print(f"no scored table at {args.scored}; run the scoring stage first", file=sys.stderr)
        return 1
    df = pd.read_csv(args.scored)
    table = audit(df)
    md = to_markdown(table)
    print(md)
    if args.write_audit:
        mode = args.mode
        if mode is None:
            import yaml
            cfg = yaml.safe_load((ROOT / "src/config/settings.yaml").read_text()) or {}
            mode = (cfg.get("scoring") or {}).get("below_benchmark", "clamp")
        write_section(md, mode)
        print(f"\nwrote {SECTION} to {AUDIT.relative_to(ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
