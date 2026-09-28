from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional

import pandas as pd

from src.calculating.factory import IndicatorScorerFactory
from src.calculating.mspi import append_mspi_rows, mspi_country_status
from src.calculating.pillar_aggregate import compute_pillar_scores, compute_subdomain_scores
from src.calculating.pillar_aggregate import compute_pillar_scores, compute_subdomain_scores
from src.calculating.pillar_taxonomy import series_code_to_filename
from src.utils.country_identity import resolve as _resolve_iso3

# World Bank series used only as a join helper for SDG 2.a.2 (agoda) scoring.
_GDP_SERIES_CODE = "NY.GDP.MKTP.CD"
_AGODA_SERIES_CODE = "DC_TOF_AGRL"

# settings.yaml runtime.interim_data key for the World Bank country metadata
# (lending type / IDS scope), and the sidecar the publisher reads.
COUNTRY_METADATA_KEY = "wb_country_metadata"
INDICATOR_STATUS_FILENAME = "indicator_status.csv"


def _load_interim_frames(paths: Iterable[Path]) -> pd.DataFrame:
    """Load and concatenate one or more cleaned interim CSVs.

    Non-SDG sources (UNDP HDR, OWID, ...) write the same minimum schema
    (country_code, country_name, year, value, indicator, series_code) but
    may not have every UN SDG column. Missing columns are filled with NA so
    the downstream groupby on series_code still works.
    """
    frames: list[pd.DataFrame] = []
    for p in paths:
        if p is None:
            continue
        path = Path(p)
        if not path.exists():
            continue
        frames.append(pd.read_csv(path))
    if not frames:
        raise FileNotFoundError("No interim CSVs found for scoring")
    return pd.concat(frames, ignore_index=True, sort=False)


def _apply_agoda_gdp_normalization(df: pd.DataFrame) -> pd.DataFrame:
    """Convert SDG 2.a.2 ag flows (millions USD) to ag-flow/GDP ratio.

    GoalRatioScorer(goal=0.02) expects the 2%-of-GDP target on a unitless ratio.
    Raw USD millions saturated every country to score 0 (issue #3).
    """
    if "series_code" not in df.columns or _AGODA_SERIES_CODE not in df["series_code"].values:
        return df

    gdp = (
        df.loc[df["series_code"] == _GDP_SERIES_CODE, ["country_code", "year", "value"]]
        .dropna(subset=["value"])
        .drop_duplicates(["country_code", "year"])
        .rename(columns={"value": "_gdp"})
    )
    if gdp.empty:
        return df

    work = df.copy()
    agoda_mask = work["series_code"] == _AGODA_SERIES_CODE
    agoda = work.loc[agoda_mask, ["country_code", "year", "value"]].merge(
        gdp, on=["country_code", "year"], how="left"
    )
    valid = (
        agoda["value"].notna()
        & agoda["_gdp"].notna()
        & (agoda["_gdp"].astype(float) > 0)
    )
    if valid.any():
        agoda.loc[valid, "value"] = (
            agoda.loc[valid, "value"].astype(float) * 1_000_000.0
        ) / agoda.loc[valid, "_gdp"].astype(float)
        work.loc[agoda_mask, "value"] = agoda["value"].values
    return work


def scoring_inputs(
    runtime_cfg: dict, repo_root: Path
) -> tuple[Optional[Path], list[Path], Optional[Path]]:
    """Resolve ``runtime.interim_data`` into scoring-stage inputs.

    Returns ``(unsdg_csv, extra_interim_csvs, country_metadata_csv)``. The
    country metadata is a scope input for the status sidecar, not a scoreable
    series, so it is kept out of the concatenated interim frame.
    """
    interim_data = (runtime_cfg or {}).get("interim_data") or {}
    unsdg_rel = interim_data.get("unsdg")
    metadata_rel = interim_data.get(COUNTRY_METADATA_KEY)
    extras = [
        repo_root / rel
        for key, rel in interim_data.items()
        if key not in ("unsdg", COUNTRY_METADATA_KEY) and rel
    ]
    return (
        (repo_root / unsdg_rel) if unsdg_rel else None,
        extras,
        (repo_root / metadata_rel) if metadata_rel else None,
    )


def load_harmonized_interim(
    interim_path: Path, extra_paths: Optional[Iterable[Path]] = None
) -> pd.DataFrame:
    """Load every interim CSV and harmonise ``country_code`` to ISO3.

    Shared by scoring and by the mspi status derivation, which needs the
    unscored component series that ``score_indicators`` later drops.
    """
    df = _load_interim_frames([interim_path, *(extra_paths or [])])

    # Harmonize the join key to ISO3 across all sources BEFORE aggregation.
    # UN SDG cleaned rows carry UN M49 numeric codes (e.g. "4"); UNDP HDR /
    # ND-GAIN / WGI carry ISO3 ("AFG"). Pillar aggregation groups by
    # country_code and the publisher joins on ISO3 — so without this, the
    # SDG-derived pillars (health/ag/si) never match the ISO3-keyed
    # country_codes.csv and silently drop out of the published payload.
    # resolve() passes ISO3 through and maps M49/name -> ISO3; unresolvable
    # codes (regional aggregates) become NaN and are dropped downstream.
    if "country_code" in df.columns:
        code_map = {c: _resolve_iso3(c) for c in df["country_code"].unique()}
        df["country_code"] = df["country_code"].map(code_map)
        df = df.dropna(subset=["country_code"])
    return df


def derive_indicator_status(
    harmonized: pd.DataFrame, country_metadata_csv: Optional[Path]
) -> pd.DataFrame:
    """Country-level indicator status sidecar (contract §3.1). Only mspi today."""
    meta = None
    if country_metadata_csv is not None and Path(country_metadata_csv).exists():
        meta = pd.read_csv(country_metadata_csv)
    return mspi_country_status(harmonized, meta)


def score_indicators(
    interim_path: Path,
    extra_paths: Optional[Iterable[Path]] = None,
    harmonized: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    df = (
        harmonized.copy()
        if harmonized is not None
        else load_harmonized_interim(interim_path, extra_paths)
    )

    df = _apply_agoda_gdp_normalization(df)
    df = append_mspi_rows(df)

    # Only score rows whose series_code is one the factory knows about.
    # Component-only rows (e.g. ND-GAIN per-indicator scores written for
    # transparency) carry a NaN series_code and would otherwise fall through
    # to the default SimpleDirectionalScorer with nonsensical results.
    known = set(IndicatorScorerFactory()._scorers.keys())  # noqa: SLF001
    if "series_code" in df.columns:
        df = df[df["series_code"].isin(known)].copy()
    else:
        # No series_code column at all - nothing to score.
        df = df.iloc[0:0].copy()

    factory = IndicatorScorerFactory()
    scores = []

    for series_code, group in df.groupby("series_code", dropna=False):
        try:
            scorer = factory.for_series(series_code)
        except KeyError:
            # Leave indicators without explicit scoring rules unchanged.
            scores.append(pd.Series(index=group.index, data=pd.NA, dtype="float"))
            continue

        scores.append(scorer.score(group))

    df["score"] = pd.concat(scores).sort_index()
    # Flag rows where a valid value was pushed down to 0.0
    df["floored_to_zero"] = df["score"].eq(0.0) & df["value"].notna()
    return df


def write_indicator_files(scored_df: pd.DataFrame, validated_dir: Path) -> None:
    indicators_dir = validated_dir / "indicatorscores"
    indicators_dir.mkdir(parents=True, exist_ok=True)
    filename_map = series_code_to_filename()

    for series_code, group in scored_df.groupby("series_code", dropna=False):
        filename = filename_map.get(series_code)
        if not filename:
            continue
        out_path = indicators_dir / filename
        group.to_csv(out_path, index=False)


def run_pipeline(
    interim_csv: Path,
    validated_dir: Path,
    extra_interim_csvs: Optional[Iterable[Path]] = None,
    country_metadata_csv: Optional[Path] = None,
) -> None:
    validated_dir.mkdir(parents=True, exist_ok=True)

    harmonized = load_harmonized_interim(interim_csv, extra_interim_csvs)
    scored_df = score_indicators(interim_csv, harmonized=harmonized)

    # Phase 1 – full indicator scores with all disaggregations.
    scored_path = validated_dir / "Indicator_Scores_Full.csv"
    scored_df.to_csv(scored_path, index=False)

    # Country-level indicator status sidecar (contract §3.1). Written only
    # when the scope input exists so the publisher can tell "no status model"
    # from "status model, every country out of scope".
    if country_metadata_csv is not None and Path(country_metadata_csv).exists():
        status_df = derive_indicator_status(harmonized, country_metadata_csv)
        status_df.to_csv(validated_dir / INDICATOR_STATUS_FILENAME, index=False)

    # Per-indicator files.
    write_indicator_files(scored_df, validated_dir)

    # Phase 2 - pillar-oriented aggregation for the frontend taxonomy.
    # Emitted in pipeline ("higher = more need") orientation; the publish step
    # inverts before sending JSON. See indicators/SCORING_AUDIT.md.
    subdomain_scores = compute_subdomain_scores(scored_df)
    pillar_scores = compute_pillar_scores(subdomain_scores)

    subdomain_scores = subdomain_scores.sort_values(
        by=["country_name", "year", "pillar_key", "subdomain_key"],
        kind="mergesort",
    )
    pillar_scores = pillar_scores.sort_values(
        by=["country_name", "year", "pillar_key"],
        kind="mergesort",
    )

    subdomain_scores.to_csv(validated_dir / "subdomainscores.csv", index=False)
    pillar_scores.to_csv(validated_dir / "pillarscores.csv", index=False)


if __name__ == "__main__":
    import yaml

    repo_root = Path(__file__).resolve().parents[2]
    settings_path = repo_root / "src" / "config" / "settings.yaml"
    with open(settings_path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    paths = cfg.get("paths") or {}
    runtime = cfg.get("runtime") or {}
    interim_data = runtime.get("interim_data") or {}
    unsdg_rel = interim_data.get("unsdg")
    validated_rel = paths.get("data_interim_validated", "data/interim/validated/")
    if not unsdg_rel:
        raise ValueError("settings.yaml missing runtime.interim_data.unsdg")
    interim_csv = repo_root / unsdg_rel
    validated_dir = repo_root / validated_rel
    _, extras, metadata_csv = scoring_inputs(runtime, repo_root)
    run_pipeline(
        interim_csv,
        validated_dir,
        extra_interim_csvs=extras,
        country_metadata_csv=metadata_csv,
    )

