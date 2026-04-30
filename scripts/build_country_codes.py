"""
Build indicators/country_codes.csv — the single source of truth joining
pipeline output (ISO3) to frontend display keys (ISO-numeric for D3/TopoJSON
map, WB region code for filters).

Sources:
  - ISO 3166-1 alpha-3 + numeric + English name:
      datahub.io/core/country-codes
  - World Bank region classification:
      https://api.worldbank.org/v2/country?format=json&per_page=400

Region codes written to the CSV match the client's frontend region IDs:
  afe  Africa Eastern & Southern
  afw  Africa Western & Central
  eap  East Asia & Pacific
  eca  Europe & Central Asia
  lcr  Latin America & Caribbean
  mna  Middle East & North Africa
  nam  North America
  sar  South Asia

This is a one-shot generator; re-run it only to refresh the table (e.g. to
pick up new country codes or WB region reshuffles).

Run:
    python scripts/build_country_codes.py
"""

from __future__ import annotations

import csv
import json
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT = REPO_ROOT / "indicators" / "country_codes.csv"

ISO_CSV_URL = (
    "https://pkgstore.datahub.io/core/country-codes/country-codes_csv/"
    "data/3b9fd39bdadd7edd7f7dcee708f47e1b/country-codes_csv.csv"
)
WB_URL = "https://api.worldbank.org/v2/country?format=json&per_page=400"

# WB region.id -> frontend region code
WB_REGION_MAP = {
    "EAS": "eap",
    "ECS": "eca",
    "LCN": "lcr",
    "MEA": "mna",
    "NAC": "nam",
    "SAS": "sar",
    # "SSF" handled separately via AFE/AFW split below.
    # "NA"  (aggregates) intentionally excluded.
}

# WB officially splits Sub-Saharan Africa into AFE and AFW since 2020.
# Source: https://blogs.worldbank.org/en/opendata/introducing-new-regional-aggregates
AFE_ISO3 = {
    "AGO", "BDI", "BWA", "COD", "COM", "ERI", "ETH", "KEN", "LSO", "MDG",
    "MOZ", "MUS", "MWI", "NAM", "RWA", "SOM", "SSD", "SDN", "SWZ", "SYC",
    "TZA", "UGA", "ZAF", "ZMB", "ZWE",
}
AFW_ISO3 = {
    "BEN", "BFA", "CAF", "CIV", "CMR", "CPV", "COG", "GAB", "GHA", "GIN",
    "GMB", "GNB", "GNQ", "LBR", "MLI", "MRT", "NER", "NGA", "SEN", "SLE",
    "STP", "TCD", "TGO",
}

# Manual overrides for codes not in ISO 3166-1 or WB aggregates we want to
# either skip or supply numeric values for.
# - CHI (Channel Islands): a WB aggregate, not a mappable country. Skipped.
# - XKX (Kosovo): no official ISO-3166-1 numeric; Natural Earth TopoJSON
#   typically uses "-99" for unofficial codes. The frontend should treat
#   this specially (e.g., fall back to centroid or skip from choropleth).
MANUAL_OVERRIDES: dict[str, dict[str, str] | None] = {
    "CHI": None,
    "XKX": {"numeric": "-99", "name": "Kosovo"},
}


def _curl(url: str) -> str:
    """Delegate HTTPS fetching to curl (avoids macOS Python's SSL issues)."""
    result = subprocess.run(
        ["curl", "-sSL", url],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def fetch_iso_table() -> dict[str, dict[str, str]]:
    """Return {ISO3: {numeric, name}} from datahub ISO 3166 dump."""
    text = _curl(ISO_CSV_URL)
    reader = csv.DictReader(text.splitlines())
    table: dict[str, dict[str, str]] = {}
    for row in reader:
        iso3 = (row.get("ISO3166-1-Alpha-3") or "").strip()
        numeric = (row.get("ISO3166-1-numeric") or "").strip()
        name = (row.get("CLDR display name") or row.get("official_name_en") or "").strip()
        if not iso3:
            continue
        table[iso3] = {"numeric": numeric.zfill(3) if numeric else "", "name": name}
    return table


def fetch_wb_regions() -> dict[str, str]:
    """Return {ISO3: frontend_region_code} from the World Bank country API."""
    payload = json.loads(_curl(WB_URL))

    regions: dict[str, str] = {}
    for entry in payload[1]:
        iso3 = entry.get("id", "").upper()
        region_id = (entry.get("region") or {}).get("id", "")
        if not iso3 or region_id == "NA":
            continue
        if region_id == "SSF":
            if iso3 in AFE_ISO3:
                regions[iso3] = "afe"
            elif iso3 in AFW_ISO3:
                regions[iso3] = "afw"
            else:
                regions[iso3] = "afe"
        elif region_id in WB_REGION_MAP:
            regions[iso3] = WB_REGION_MAP[region_id]
    return regions


def main() -> None:
    iso_table = fetch_iso_table()
    wb_regions = fetch_wb_regions()

    rows = []
    for iso3, region in wb_regions.items():
        if iso3 in MANUAL_OVERRIDES:
            override = MANUAL_OVERRIDES[iso3]
            if override is None:
                continue
            rows.append(
                {
                    "iso3": iso3,
                    "iso_numeric": override["numeric"],
                    "name": override["name"],
                    "wb_region_code": region,
                }
            )
            continue

        iso_entry = iso_table.get(iso3, {})
        rows.append(
            {
                "iso3": iso3,
                "iso_numeric": iso_entry.get("numeric", ""),
                "name": iso_entry.get("name", ""),
                "wb_region_code": region,
            }
        )

    rows.sort(key=lambda r: r["iso3"])

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["iso3", "iso_numeric", "name", "wb_region_code"]
        )
        writer.writeheader()
        writer.writerows(rows)

    counts: dict[str, int] = {}
    missing_numeric = 0
    for r in rows:
        counts[r["wb_region_code"]] = counts.get(r["wb_region_code"], 0) + 1
        if not r["iso_numeric"]:
            missing_numeric += 1
    print(f"Wrote {len(rows)} rows to {OUTPUT.relative_to(REPO_ROOT)}")
    for k, v in sorted(counts.items()):
        print(f"  {k}: {v}")
    if missing_numeric:
        print(f"WARN: {missing_numeric} rows missing ISO numeric")


if __name__ == "__main__":
    main()
