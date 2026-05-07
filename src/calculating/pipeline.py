from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.calculating.factory import IndicatorScorerFactory
from src.calculating.pillar_aggregate import compute_pillar_scores, compute_subdomain_scores
from src.calculating.pillar_taxonomy import series_code_to_filename


def score_indicators(interim_path: Path) -> pd.DataFrame:
    df = pd.read_csv(interim_path)

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
) -> None:
    validated_dir.mkdir(parents=True, exist_ok=True)

    scored_df = score_indicators(interim_csv)

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
    run_pipeline(interim_csv, validated_dir)

