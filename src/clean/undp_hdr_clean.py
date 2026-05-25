from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from src.clean.base_clean import DataCleaner
from src.pipeline.utils import ensure_dir, project_root
from src.pipeline.terminal_output import TerminalOutput
from src.utils.country_identity import name_to_iso3 as _resolve_iso3
from src.utils.country_names import get_canonical_name


# HDR composite-indices CSV ships as latin-1 (special chars in country names).
_HDR_ENCODING = "latin-1"

# Year-suffix pattern: only keep columns like "gii_1990".."gii_2022";
# drops rank/group columns like "gii_rank_2022".
_YEAR_SUFFIX_RE = re.compile(r"^(?P<prefix>.+_)(?P<year>(19|20)\d{2})$")

# Survey-year pattern used by OPHI MPI tables, e.g. "2022/2023 M", "2010 D",
# "2019/2020 M". We take the second (later) year as the canonical year.
_SURVEY_YEAR_RE = re.compile(
    r"^\s*(?:(?:19|20)\d{2})(?:\s*/\s*((?:19|20)\d{2}))?\s*[A-Za-z]?\s*$"
)
_ANY_YEAR_RE = re.compile(r"(?:19|20)\d{2}")


class UNDPHDRCleaner(DataCleaner):
    """
    Clean UNDP Human Development Reports data.

    Inputs: the fetcher's manifest list (alias, local_path, indicators, ...).
    For each file in the manifest, melt the configured wide year-suffix
    columns into the tidy schema other cleaners emit:

        country_code, country_name, year, value, indicator, series_code

    The `indicator` column carries the human-readable HDR file alias
    (e.g. "gii"); `series_code` carries the canonical pipeline code
    (e.g. "GII_INDEX") that the scorer factory looks up.

    Adding a new HDR indicator (e.g. MPI) is config-only: add a file entry
    under undp_hdr.files in settings.yaml with the right column_prefix.
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

    def save_interim(self, df: pd.DataFrame, out_path: Path) -> None:
        ensure_dir(out_path.parent)
        df.to_csv(out_path, index=False)

    def clean_data(self, manifest: List[Dict[str, Any]]) -> pd.DataFrame:
        if not manifest:
            TerminalOutput.info("No UNDP HDR files in manifest", indent=1)
            return pd.DataFrame()

        repo_root = project_root()
        frames: List[pd.DataFrame] = []

        for entry in manifest:
            local_path_rel = entry.get("local_path")
            if not local_path_rel:
                TerminalOutput.info(
                    f"  skipping {entry.get('alias')}: no local file (download failed?)",
                    indent=1,
                )
                continue

            local_path = repo_root / local_path_rel
            if not local_path.exists():
                TerminalOutput.info(f"  missing file on disk: {local_path}", indent=1)
                continue

            fmt = entry.get("format") or "wide_year_suffix"
            alias = entry.get("alias")
            for ind_spec in entry.get("indicators", []) or []:
                if fmt == "wide_year_suffix":
                    raw = self._read(local_path)
                    tidy = self._melt_indicator(raw, ind_spec, alias=alias)
                elif fmt == "ophi_mpi_table":
                    tidy = self._parse_ophi_mpi_table(local_path, ind_spec, alias=alias)
                else:
                    TerminalOutput.info(f"  unknown format '{fmt}' for {alias}", indent=1)
                    tidy = pd.DataFrame()
                if not tidy.empty:
                    frames.append(tidy)

        if not frames:
            TerminalOutput.info("UNDP HDR: no indicator rows extracted", indent=1)
            return pd.DataFrame()

        df = pd.concat(frames, ignore_index=True)

        # Canonicalize country names against indicators/country_codes.csv.
        df["country_name"] = df.apply(
            lambda r: get_canonical_name(str(r["country_code"]), str(r.get("country_name") or "")),
            axis=1,
        )

        df = df.sort_values(
            ["country_name", "series_code", "year"], kind="mergesort"
        ).reset_index(drop=True)

        TerminalOutput.summary("  UNDP HDR rows", f"{len(df):,}")
        TerminalOutput.summary(
            "  by series",
            ", ".join(f"{k}={v}" for k, v in df["series_code"].value_counts().items()),
        )
        return df

    # ------------------------------------------------------------------

    def _read(self, path: Path) -> pd.DataFrame:
        # HDR composite-indices ships as latin-1 (Côte d'Ivoire et al.).
        # XLSX files (MPI) would be handled here when added.
        if path.suffix.lower() in {".xlsx", ".xls"}:
            return pd.read_excel(path)
        return pd.read_csv(path, encoding=_HDR_ENCODING)

    def _melt_indicator(
        self,
        raw: pd.DataFrame,
        spec: Dict[str, Any],
        alias: str | None,
    ) -> pd.DataFrame:
        series_code = spec.get("series_code")
        prefix = spec.get("column_prefix")
        if not series_code or not prefix:
            return pd.DataFrame()

        year_cols: List[str] = []
        for col in raw.columns:
            m = _YEAR_SUFFIX_RE.match(str(col))
            if m and m.group("prefix") == prefix:
                year_cols.append(col)

        if not year_cols:
            TerminalOutput.info(
                f"  no year columns for {series_code} (prefix={prefix}) in {alias}",
                indent=1,
            )
            return pd.DataFrame()

        # HDR uses ISO3 in `iso3` and country label in `country`.
        id_cols = [c for c in ("iso3", "country") if c in raw.columns]
        if "iso3" not in id_cols:
            TerminalOutput.info(f"  {alias}: missing iso3 column; cannot tidy", indent=1)
            return pd.DataFrame()

        long = raw[id_cols + year_cols].melt(
            id_vars=id_cols,
            value_vars=year_cols,
            var_name="_yearcol",
            value_name="value",
        )
        long["year"] = (
            long["_yearcol"].str.replace(prefix, "", regex=False).astype("Int64")
        )
        long = long.drop(columns=["_yearcol"])
        long = long.rename(columns={"iso3": "country_code", "country": "country_name"})
        if "country_name" not in long.columns:
            long["country_name"] = ""

        long["value"] = pd.to_numeric(long["value"], errors="coerce")
        long = long.dropna(subset=["value"])

        # HDR ships a few non-country aggregate rows (region, world). Keep
        # them out by relying on the country_names canonicalizer downstream;
        # for now we keep only rows whose iso3 looks like a 3-letter code.
        long = long[long["country_code"].astype(str).str.match(r"^[A-Z]{3}$", na=False)]

        long["indicator"] = alias or series_code.lower()
        long["series_code"] = series_code
        return long[["country_code", "country_name", "year", "value", "indicator", "series_code"]]

    def _parse_ophi_mpi_table(
        self,
        path: Path,
        spec: Dict[str, Any],
        alias: str | None,
    ) -> pd.DataFrame:
        """Parse an OPHI / UNDP HDR Global MPI 'Table 2' style sheet.

        These sheets have a multi-row header (title, group, sub-header) and
        then survey-wave rows like (Country, "2022/2023 M", MPI value, ...).
        Each country can have multiple survey waves; we keep all of them.

        Year handling: the survey-year string covers a fielding window
        (e.g. "2015/2016 D"). We use the END year as the canonical year so
        the value lines up with when the data was finalized. This matches
        OPHI's convention of citing surveys by their later year.

        Country labels are HDR/UN long forms (e.g. "Bolivia (Plurinational
        State of)"); we resolve to ISO3 via `_resolve_iso3` and drop rows
        whose label isn't a recognized country (footer/definitions rows).
        """
        series_code = spec.get("series_code")
        sheet = spec.get("sheet", "gMPI_Table2")
        country_col = int(spec.get("country_col", 0))
        year_col = int(spec.get("year_col", 2))
        value_col = int(spec.get("value_col", 4))
        skiprows = int(spec.get("data_start_row", 5))

        if not series_code:
            return pd.DataFrame()

        raw = pd.read_excel(path, sheet_name=sheet, header=None, skiprows=skiprows)
        if raw.empty:
            return pd.DataFrame()

        df = pd.DataFrame({
            "country_label": raw.iloc[:, country_col],
            "year_label": raw.iloc[:, year_col],
            "raw_value": raw.iloc[:, value_col],
        })
        # Forward-fill country names (some sheets blank repeats on later waves).
        df["country_label"] = df["country_label"].ffill()

        # Keep only rows whose year-label looks like a survey window string.
        df["year_label"] = df["year_label"].astype(str)
        df = df[df["year_label"].apply(self._is_survey_year_string)]

        # Coerce MPI value (some cells carry footnote markers in adjacent cols
        # but the value column should already be numeric).
        df["value"] = pd.to_numeric(df["raw_value"], errors="coerce")
        df = df.dropna(subset=["value"])

        df["year"] = df["year_label"].apply(self._survey_end_year).astype("Int64")
        df = df.dropna(subset=["year"])

        df["country_code"] = df["country_label"].apply(_resolve_iso3)
        unresolved = df[df["country_code"].isna()]
        if len(unresolved):
            sample = unresolved["country_label"].drop_duplicates().head(8).tolist()
            TerminalOutput.info(
                f"  {alias}: dropping {len(unresolved)} rows with unresolved names; sample: {sample}",
                indent=1,
            )
        df = df.dropna(subset=["country_code"])

        df["country_name"] = df["country_label"]
        df["indicator"] = alias or series_code.lower()
        df["series_code"] = series_code

        return df[["country_code", "country_name", "year", "value", "indicator", "series_code"]]

    @staticmethod
    def _is_survey_year_string(s: str) -> bool:
        if not isinstance(s, str):
            return False
        return bool(_SURVEY_YEAR_RE.match(s.strip()))

    @staticmethod
    def _survey_end_year(s: str) -> Optional[int]:
        matches = _ANY_YEAR_RE.findall(s)
        if not matches:
            return None
        return int(matches[-1])
