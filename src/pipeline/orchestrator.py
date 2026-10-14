"""
Orchestrates the entire data pipeline: fetch, clean, score, upload, publish.

Created and run by run_pipeline.py. The last line of output is always one of

    PIPELINE RUN COMPLETE: published v1 snapshot <run id>, <n> countries
    PIPELINE RUN COMPLETE: dry run, snapshot <run id> written locally, <n> countries
    PIPELINE RUN FAILED: <stage> <reason>; previous /v1/ snapshot unchanged

so a non-engineer reading the Azure job log knows what happened
(requirements v2, REQ3.5 and REQ3.6).
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

import yaml
from dotenv import load_dotenv

from src.archive import archive_run
from src.pipeline.utils import project_root
from src.fetch.fetch_data import FetchData
from src.fetch.ndgain_source import NdgainSourceError
from src.clean.clean_data import CleanData
from src.calculating.pipeline import run_pipeline as run_scoring_pipeline, scoring_inputs
from src.upload.azure_credential import azure_configured, credential_kind
from src.validation import DataQualityError, run_validation
from src.upload.upload_validated import UploadValidated
from src.upload.publish_dashboard import publish as publish_dashboard


# Runtime toggles can be overridden by environment so the container image
# ships with the safe local defaults (fetch_raw false) and the Azure job
# turns the live path on without editing settings.yaml.
_ENV_OVERRIDES = {
    "fetch_raw": "PIPELINE_FETCH_RAW",
    "upload_azure": "PIPELINE_UPLOAD_AZURE",
    "publish_dashboard": "PIPELINE_PUBLISH_DASHBOARD",
    "run_forecasts": "PIPELINE_RUN_FORECASTS",
    "archive_raw": "PIPELINE_ARCHIVE_RAW",
}


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _count_countries(root: Path, paths_cfg: dict) -> int | None:
    organized = root / (paths_cfg.get("data_organized") or "data/organized/") / "v1" / "countries.json"
    if organized.exists():
        try:
            payload = json.loads(organized.read_text(encoding="utf-8"))
            rows = payload.get("countries", payload) if isinstance(payload, dict) else payload
            return len(rows)
        except (ValueError, TypeError):
            pass
    pillars = root / (paths_cfg.get("data_interim_validated") or "data/interim/validated/") / "pillarscores.csv"
    if pillars.exists():
        import pandas as pd
        return int(pd.read_csv(pillars, usecols=["country_name"])["country_name"].nunique())
    return None


class Orchestrator:
    def __init__(self, config_path: str = project_root() / "src/config/settings.yaml") -> None:
        load_dotenv()
        self.config_path = Path(config_path)

    def run(self) -> int:
        """Run every stage. Returns the process exit code and prints the
        completion or failure line last."""
        try:
            return self._run(self._set_stage)
        except NdgainSourceError as exc:
            return self._fail("nd-gain source", str(exc))
        except DataQualityError as exc:
            return self._fail("data validation", str(exc))
        except Exception as exc:  # noqa: BLE001  one failure line, whatever the cause
            traceback.print_exc()
            return self._fail(self._stage, f"{type(exc).__name__}: {exc}")

    # -- internals -----------------------------------------------------------

    _stage = "startup"

    def _set_stage(self, name: str) -> None:
        self._stage = name
        print(f"==== stage: {name} ====", flush=True)

    @staticmethod
    def _fail(stage: str, reason: str) -> int:
        line = f"PIPELINE RUN FAILED: {stage} {reason}; previous /v1/ snapshot unchanged"
        print(line, flush=True)
        print(line, file=sys.stderr, flush=True)
        return 1

    def _run(self, set_stage) -> int:
        cfg = yaml.safe_load(self.config_path.read_text(encoding="utf-8")) or {}
        runtime_cfg = dict(cfg.get("runtime") or {})
        paths_cfg = cfg.get("paths") or {}
        root = project_root()

        defaults = {"fetch_raw": False, "upload_azure": True, "publish_dashboard": True, "run_forecasts": False, "archive_raw": True}
        for key, env in _ENV_OVERRIDES.items():
            runtime_cfg[key] = _env_bool(env, bool(runtime_cfg.get(key, defaults[key])))
        fetch_raw = runtime_cfg["fetch_raw"]
        below_benchmark = (cfg.get("scoring") or {}).get("below_benchmark", "clamp")

        print(
            f"run config: fetch_raw={fetch_raw} upload_azure={runtime_cfg.get('upload_azure')} "
            f"publish_dashboard={runtime_cfg.get('publish_dashboard')} run_forecasts={runtime_cfg.get('run_forecasts')} "
            f"below_benchmark={below_benchmark} azure={credential_kind()}",
            flush=True,
        )

        for rel in (
            paths_cfg.get("data_raw"),
            paths_cfg.get("data_clean"),
            paths_cfg.get("data_processed"),
            paths_cfg.get("data_organized"),
            paths_cfg.get("data_interim_validated"),
        ):
            if rel:
                (root / rel).mkdir(parents=True, exist_ok=True)

        # One run id for the raw store and the published snapshot.
        run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

        # FETCH
        set_stage("fetch")
        if fetch_raw:
            fetched_data = FetchData(self.config_path).fetch()
        else:
            print("fetch_raw is false: reusing data/raw", flush=True)
            fetched_data = None

        # RAW STORE: lossless copy of what fetch produced, with inventory
        if runtime_cfg.get("archive_raw", True):
            set_stage("raw store")
            archive_run(cfg, root, run_id)

        # CLEAN
        set_stage("clean")
        CleanData(self.config_path).clean(fetched_data)

        # SCORE
        set_stage("score")
        validated_rel = paths_cfg.get("data_interim_validated", "data/interim/validated/")
        unsdg_csv, extras, metadata_csv = scoring_inputs(runtime_cfg, root)
        if unsdg_csv is not None:
            run_scoring_pipeline(
                unsdg_csv,
                root / validated_rel,
                extra_interim_csvs=extras,
                country_metadata_csv=metadata_csv,
                below_benchmark=below_benchmark,
            )

        # DATA VALIDATION: blocks publish on sawtooth series, conflicting
        # disaggregations, basket violations (docs/data-quality-issues.md)
        set_stage("data validation")
        run_validation(root / validated_rel)

        # UPLOAD validated CSVs (private container) when upload_azure is on
        set_stage("upload validated")
        UploadValidated(self.config_path).upload()

        # FORECASTS (default off). Must precede publish.
        if runtime_cfg.get("run_forecasts", False):
            set_stage("forecasts")
            from projections.process_data import ProcessData

            ProcessData(self.config_path).process()

        # PUBLISH contract JSON. Validation gates the upload; meta.json last.
        live = False
        if runtime_cfg.get("publish_dashboard", True):
            set_stage("publish")
            publish_cfg = cfg.get("publish") or {}
            live = bool(runtime_cfg.get("upload_azure", False)) and azure_configured()
            publish_dashboard(
                repo_root=root,
                pipeline_run_id=run_id,
                target_container=publish_cfg.get("dashboard_container_name", "dashboard-public"),
                prefix=publish_cfg.get("dashboard_prefix", "v1/"),
                dry_run=not live,
            )

        n = _count_countries(root, paths_cfg)
        count = f"{n} countries" if n is not None else "country count unavailable"
        if live:
            print(f"PIPELINE RUN COMPLETE: published v1 snapshot {run_id}, {count}", flush=True)
        else:
            print(f"PIPELINE RUN COMPLETE: dry run, snapshot {run_id} written locally, {count}", flush=True)
        return 0
