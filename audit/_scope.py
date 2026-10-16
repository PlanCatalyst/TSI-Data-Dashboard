"""Published country scope for the audit (indicators/country_codes.csv, 216 rows). Not src."""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent


def scope_iso3():
    return set(pd.read_csv(ROOT / "indicators/country_codes.csv", dtype=str)["iso3"])


def restrict(df):
    """Return (rows in scope, rows out of scope) for a frame with an iso3 column."""
    ok = df["iso3"].isin(scope_iso3())
    return df[ok].copy(), df[~ok].copy()


def is_aggregate_name(name):
    n = str(name).lower()
    return ("[former]" in n or "non-specified" in n or "aggregate" in n)


def oos_line(codes_names, n_rows, extra_aggregates=0):
    """codes_names: {code: name} of everything out of scope that was seen.
    Real economies are listed; aggregate-like entries are summarised as a count."""
    real = {c: n for c, n in codes_names.items() if not is_aggregate_name(n) and not str(c).startswith("ZZ")}
    agg = len(codes_names) - len(real) + extra_aggregates
    listed = ", ".join(f"{c} ({n})" for c, n in sorted(real.items(), key=lambda kv: str(kv[0]))) or "none"
    return (f"**Out of scope** (not in indicators/country_codes.csv, not emitted): {len(codes_names) + extra_aggregates} codes, "
            f"{n_rows} rows. Real economies ({len(real)}): {listed}. Aggregates / former / non-specified areas: {agg}.")
