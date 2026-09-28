from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

from src.clean.base_clean import DataCleaner
from src.pipeline.utils import ensure_dir, project_root
from src.pipeline.terminal_output import TerminalOutput
from src.utils.country_names import get_canonical_name


# Default columns in the WGI per-dimension sheets (`ge`, `rq`, ...).
# Each sheet has the same schema. "Governance score (0-100)" is the
# pre-normalized favorability score used by `state` / WGI_GOVEFF.
# "Governance estimate" is the native EST scale (−2.5 to +2.5) used by
# the mspi fragility component. Do not mix the two.
_DEFAULT_ISO3_COL = "Economy (code)"
_DEFAULT_NAME_COL = "Economy (name)"
_DEFAULT_YEAR_COL = "Year"
_DEFAULT_SCORE_COL = "Governance score (0-100)"
_EST_SCORE_COL = "Governance estimate (approx. -2.5 to +2.5)"
_SCORE_COL_ALIASES = {
    "estimate": _EST_SCORE_COL,
    "score_0_100": _DEFAULT_SCORE_COL,
}


class WBWGICleaner(DataCleaner):
    """
    Clean World Bank Worldwide Governance Indicators (WGI) data.

    For each file in the fetcher's manifest, read the configured sheet and
    score column. Indicator specs come from `settings.yaml` `wb_wgi.files`
    (matched by alias), not the on-disk fetch manifest, so adding a series
    does not require re-downloading the XLSX.

    Emit the tidy schema:

        country_code, country_name, year, value, indicator, series_code
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.config = config

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

            for ind_spec in self._indicator_specs(entry):
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

    def _indicator_specs(self, entry: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Prefer live yaml specs over the fetch-time manifest snapshot."""
        alias = entry.get("alias")
        files = ((self.config or {}).get("wb_wgi") or {}).get("files") or []
        for spec in files:
            if spec.get("alias") == alias and spec.get("indicators"):
                return list(spec["indicators"])
        return list(entry.get("indicators") or [])

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
        score_col = _SCORE_COL_ALIASES.get(score_col, score_col)

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
