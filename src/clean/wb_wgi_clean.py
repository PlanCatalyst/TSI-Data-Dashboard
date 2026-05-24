from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

from src.clean.base_clean import DataCleaner
from src.pipeline.utils import ensure_dir, project_root
from src.pipeline.terminal_output import TerminalOutput
from src.utils.country_names import get_canonical_name


# Default columns in the WGI per-dimension sheets (`ge`, `rq`, ...).
# Each sheet has the same schema. The "Governance score (0-100)" is a
# pre-normalized 0-100 favorability score (higher = better governance)
# published by WGI itself. We use that directly; no in-pipeline
# normalization is needed.
_DEFAULT_ISO3_COL = "Economy (code)"
_DEFAULT_NAME_COL = "Economy (name)"
_DEFAULT_YEAR_COL = "Year"
_DEFAULT_SCORE_COL = "Governance score (0-100)"


class WBWGICleaner(DataCleaner):
    """
    Clean World Bank Worldwide Governance Indicators (WGI) data.

    For each file in the fetcher's manifest, read the configured sheet and
    score column. Emit the tidy schema:

        country_code, country_name, year, value, indicator, series_code

    The `value` column carries the WGI pre-normalized 0-100 score where
    HIGHER = better governance (i.e. dashboard orientation). The scorer
    (`SimpleDirectionalScorer`) does `100 - value` to flip into the
    pipeline's vulnerability orientation; the publish boundary then flips
    back, so consumers of the contract see the WGI's original 0-100 number.
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

    def save_interim(self, df: pd.DataFrame, out_path: Path) -> None:
        ensure_dir(out_path.parent)
        df.to_csv(out_path, index=False)

    def clean_data(self, manifest: List[Dict[str, Any]]) -> pd.DataFrame:
        if not manifest:
            TerminalOutput.info("No WGI files in manifest", indent=1)
            return pd.DataFrame()

        repo_root = project_root()
        frames: List[pd.DataFrame] = []

        for entry in manifest:
            local_path_rel = entry.get("local_path")
            if not local_path_rel:
                continue
            local_path = repo_root / local_path_rel
            if not local_path.exists():
                TerminalOutput.info(f"  missing file on disk: {local_path}", indent=1)
                continue

            for ind_spec in entry.get("indicators", []) or []:
                tidy = self._extract_sheet(local_path, ind_spec, alias=entry.get("alias"))
                if not tidy.empty:
                    frames.append(tidy)

        if not frames:
            return pd.DataFrame()

        df = pd.concat(frames, ignore_index=True)

        df["country_name"] = df.apply(
            lambda r: get_canonical_name(str(r["country_code"]), str(r.get("country_name") or "")),
            axis=1,
        )

        df = df.sort_values(
            ["country_name", "series_code", "year"], kind="mergesort"
        ).reset_index(drop=True)

        TerminalOutput.summary("  WGI rows", f"{len(df):,}")
        TerminalOutput.summary(
            "  by series",
            ", ".join(f"{k}={v}" for k, v in df["series_code"].value_counts().items()),
        )
        return df

    def _extract_sheet(
        self,
        path: Path,
        spec: Dict[str, Any],
        alias: str | None,
    ) -> pd.DataFrame:
        series_code = spec.get("series_code")
        sheet = spec.get("sheet")
        if not series_code or not sheet:
            return pd.DataFrame()

        iso3_col = spec.get("iso3_col", _DEFAULT_ISO3_COL)
        name_col = spec.get("name_col", _DEFAULT_NAME_COL)
        year_col = spec.get("year_col", _DEFAULT_YEAR_COL)
        score_col = spec.get("score_col", _DEFAULT_SCORE_COL)

        raw = pd.read_excel(path, sheet_name=sheet)
        missing = [c for c in (iso3_col, year_col, score_col) if c not in raw.columns]
        if missing:
            TerminalOutput.info(
                f"  {alias}/{sheet}: missing expected columns {missing}; skipping",
                indent=1,
            )
            return pd.DataFrame()

        tidy = pd.DataFrame({
            "country_code": raw[iso3_col].astype(str).str.strip(),
            "country_name": raw[name_col].astype(str) if name_col in raw.columns else "",
            "year": pd.to_numeric(raw[year_col], errors="coerce").astype("Int64"),
            "value": pd.to_numeric(raw[score_col], errors="coerce"),
        })

        # Drop rows missing core fields.
        tidy = tidy.dropna(subset=["year", "value"])
        # Drop WGI region/aggregate rows (sometimes share the same sheet).
        tidy = tidy[tidy["country_code"].str.match(r"^[A-Z]{3}$", na=False)]

        tidy["indicator"] = alias or sheet
        tidy["series_code"] = series_code
        return tidy[["country_code", "country_name", "year", "value", "indicator", "series_code"]]
