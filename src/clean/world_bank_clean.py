
from typing import Dict, Any, List
import pandas as pd

from src.clean.base_clean import DataCleaner
from src.pipeline.utils import ensure_dir
from src.pipeline.terminal_output import TerminalOutput
from pathlib import Path
from src.utils.country_names import get_canonical_name

class WorldBankCleaner(DataCleaner):
    """
    Clean World Bank data
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

    def save_interim(self, df: pd.DataFrame, out_path: Path) -> None:
        """
        Saves the tidy DataFrame as a CSV file.
        """
        ensure_dir(out_path.parent)
        df.to_csv(out_path, index=False)
    
    def clean_data(self, indicator_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        Conert raw API indicator_data into a tidy DataFrame.

        Args:
            indicator_data (List[Dict[str, Any]]): List of indicator_data to convert
            alias (str): User-friendly name for the indicator

        Returns:
            pd.DataFrame: Cleaned DataFrame with country_code (ISO3), country_name, indicator-code,
            indicator, year, and value (aligned with other interim CSVs).
        """

        # Debug: Check first few records
        # if indicator_data:
        #     print(f"\n=== First 3 raw records ===")
        #     for i, rec in enumerate(indicator_data[:3]):
        #         print(f"\nRecord {i}:")
        #         print(f"  country: {rec.get('country')}")
        #         print(f"  countryiso3code: {rec.get('countryiso3code')}")
        #         print(f"  indicator: {rec.get('indicator')}")
        #         print(f"  date: {rec.get('date')}")
        #         print(f"  value: {rec.get('value')}")
    
        rows = []
        for rec in indicator_data or []:
            rows.append({
                "country_code": rec.get("countryiso3code"),
                "country_name": (rec.get("country") or {}).get("value"),
                "indicator-code": (rec.get("indicator") or {}).get("id"),
                "indicator": (rec.get("indicator") or {}).get("value"),
                "year": int(rec.get("date")) if str(rec.get("date")).isdigit() else rec.get("date"),
                "value": rec.get("value")
            })

        df = pd.DataFrame(
            rows,
            columns=[
                "country_code",
                "country_name",
                "indicator-code",
                "indicator",
                "year",
                "value",
            ],
        )
        # Scoring joins on series_code (same WB indicator id, e.g. EN.POP.DNST).
        df["series_code"] = df["indicator-code"]
        df["country_name"] = df.apply(
            lambda r: get_canonical_name(str(r["country_code"]), str(r.get("country_name") or "")),
            axis=1,
        )

        df = df.sort_values(
            ["country_name", "year"], ascending=[True, True], na_position="last"
        )

        TerminalOutput.summary("  Records", f"{len(df):,}")
        
        return df
    # IDS reporting scope. A country reports to the Debtor Reporting System if the
    # World Bank classifies it as an IBRD ("IBD"), blend ("IDB") or IDA ("IDX")
    # borrower. "LNX" (not classified) covers high-income non-borrowers and is out
    # of scope. Source: client spec revision 2026-09-23, docs/spec-macrosec-index.md.
    IDS_SCOPE_LENDING_TYPES = ("IBD", "IDB", "IDX")

    # World Bank marks aggregate rows (regions, income groups) with this region id.
    _AGGREGATE_REGION_ID = "NA"

    def clean_country_metadata(self, records: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        Convert raw ``/v2/country`` records into a country reference table.

        Drops World Bank aggregates (regions and income groups), which are
        identified by ``region.id == "NA"`` and would otherwise appear alongside
        real countries in any join on ``country_code``.

        Returns columns ``country_code``, ``country_name``, ``lending_type``,
        ``income_level``, ``region``, ``ids_in_scope``.
        """
        rows = []
        for rec in records or []:
            region_id = (rec.get("region") or {}).get("id") or ""
            if region_id.strip() == self._AGGREGATE_REGION_ID:
                continue
            iso3 = (rec.get("id") or "").strip()
            if not iso3:
                continue
            lending_type = ((rec.get("lendingType") or {}).get("id") or "").strip()
            rows.append({
                "country_code": iso3,
                "country_name": get_canonical_name(iso3, str(rec.get("name") or "").strip()),
                "lending_type": lending_type or None,
                "income_level": ((rec.get("incomeLevel") or {}).get("id") or "").strip() or None,
                "region": region_id.strip() or None,
                "ids_in_scope": lending_type in self.IDS_SCOPE_LENDING_TYPES,
            })

        df = pd.DataFrame(
            rows,
            columns=[
                "country_code",
                "country_name",
                "lending_type",
                "income_level",
                "region",
                "ids_in_scope",
            ],
        )
        df = df.drop_duplicates("country_code", keep="last").sort_values(
            "country_code", na_position="last"
        )

        TerminalOutput.summary("  Countries", f"{len(df):,}")
        TerminalOutput.summary("  IDS in scope", f"{int(df['ids_in_scope'].sum()):,}")

        return df.reset_index(drop=True)
