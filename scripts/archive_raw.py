"""Archive the current data/raw snapshot into the raw data store without
fetching. Use it to capture a baseline before a fresh pipeline run.

    python3 scripts/archive_raw.py                  # run id = snapshot-<today>
    python3 scripts/archive_raw.py --run-id my-id
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.archive import archive_run
from src.pipeline.utils import project_root


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", default=f"snapshot-{date.today():%Y%m%d}")
    args = ap.parse_args()
    root = project_root()
    cfg = yaml.safe_load((root / "src/config/settings.yaml").read_text(encoding="utf-8")) or {}
    archive_run(cfg, Path(root), args.run_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
