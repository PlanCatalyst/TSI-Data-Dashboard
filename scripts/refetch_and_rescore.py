"""
Ad-hoc driver: force a fresh upstream fetch, then clean + score, with NO Azure
upload of any kind.

Mirrors src/pipeline/orchestrator.py (fetch -> clean -> score) but:
  - always fetches (ignores runtime.fetch_raw), since the whole point is a refetch
  - SKIPS the upload_validated stage, so nothing is written to Azure
  - does NOT touch publish_dashboard / dashboard-public (Christina's lane)

Not part of the production pipeline. Safe to delete.
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import yaml
from dotenv import load_dotenv

from src.pipeline.utils import project_root
from src.fetch.fetch_data import FetchData
from src.clean.clean_data import CleanData
from src.calculating.pipeline import run_pipeline as run_scoring_pipeline


def main() -> None:
    load_dotenv()
    root = project_root()
    config_path = root / "src/config/settings.yaml"
    cfg = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    runtime_cfg = cfg.get("runtime") or {}
    paths_cfg = cfg.get("paths") or {}

    print(">>> FETCH (forced fresh upstream pull)", flush=True)
    fetched = FetchData(config_path).fetch()
    print(">>> FETCH done; sources:", list((fetched or {}).keys()), flush=True)

    print(">>> CLEAN", flush=True)
    CleanData(config_path).clean(fetched)
    print(">>> CLEAN done", flush=True)

    print(">>> SCORE", flush=True)
    interim_data_cfg = runtime_cfg.get("interim_data") or {}
    unsdg_rel = interim_data_cfg.get("unsdg")
    validated_rel = paths_cfg.get("data_interim_validated", "data/interim/validated/")
    extras = [
        root / rel
        for key, rel in interim_data_cfg.items()
        if key != "unsdg" and rel
    ]
    run_scoring_pipeline(root / unsdg_rel, root / validated_rel, extra_interim_csvs=extras)
    print(">>> SCORE done -- validated CSVs refreshed. No Azure writes performed.", flush=True)


if __name__ == "__main__":
    main()