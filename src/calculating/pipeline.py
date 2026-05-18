from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional

import pandas as pd

from src.calculating.factory import IndicatorScorerFactory
from src.calculating.pillar_aggregate import compute_pillar_scores, compute_subdomain_scores
from src.calculating.pillar_taxonomy import series_code_to_filename


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


def score_indicators(interim_path: Path, extra_paths: Optional[Iterable[Path]] = None) -> pd.DataFrame:
    df = _load_interim_frames([interim_path, *(extra_paths or [])])

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
) -> None:
    validated_dir.mkdir(parents=True, exist_ok=True)

    scored_df = score_indicators(interim_csv, extra_interim_csvs)

    # Phase 1 – full indicator scores with all disaggregations.
    scored_path = validated_dir / "Indicator_Scores_Full.csv"
    scored_df.to_csv(scored_path, index=False)

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
    extras = [
        repo_root / rel
        for key, rel in interim_data.items()
        if key != "unsdg" and rel
    ]
    run_pipeline(interim_csv, validated_dir, extra_interim_csvs=extras)

