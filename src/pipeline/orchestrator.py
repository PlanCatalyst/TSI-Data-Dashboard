'''
Orchestrates the entire data pipeline.

Orchestrator class is created and run in run_pipeline.py
'''

from pathlib import Path

import yaml
from dotenv import load_dotenv

from src.pipeline.utils import project_root
from src.fetch.fetch_data import FetchData
from src.clean.clean_data import CleanData
from src.calculating.pipeline import run_pipeline as run_scoring_pipeline
from src.upload.upload_validated import UploadValidated

class Orchestrator:
    def __init__(self, config_path: str = project_root() / "src/config/settings.yaml") -> None:

        load_dotenv()
        self.config_path = Path(config_path)

    def run(self) -> None:

        cfg = yaml.safe_load(self.config_path.read_text(encoding="utf-8")) or {}
        runtime_cfg = cfg.get("runtime") or {}
        paths_cfg = cfg.get("paths") or {}
        fetch_raw = runtime_cfg.get("fetch_raw", True)
        root = project_root()

        # Ensure data roots exist for current repo layout.
        for rel in (
            paths_cfg.get("data_raw"),
            paths_cfg.get("data_clean"),
            paths_cfg.get("data_processed"),
            paths_cfg.get("data_organized"),
            paths_cfg.get("data_interim_validated"),
        ):
            if rel:
                (root / rel).mkdir(parents=True, exist_ok=True)

        # ============================================================
        # FETCH
        # ============================================================
        if fetch_raw:
            fetchData = FetchData(self.config_path)
            fetched_data = fetchData.fetch()  # in-memory dict by source
        else:
            fetched_data = None  # CleanData.clean(None) loads from data/raw via load_raw_data()

        # ============================================================
        # CLEAN
        # ============================================================
        cleanData = CleanData(self.config_path)
        cleanData.clean(fetched_data)

        # ============================================================
        # CALCULATING (scores → data/interim/validated/)
        # ============================================================
        interim_data_cfg = runtime_cfg.get("interim_data") or {}
        unsdg_rel = interim_data_cfg.get("unsdg")
        validated_rel = paths_cfg.get("data_interim_validated", "data/interim/validated/")
        if unsdg_rel:
            extras = [
                root / rel
                for key, rel in interim_data_cfg.items()
                if key != "unsdg" and rel
            ]
            run_scoring_pipeline(root / unsdg_rel, root / validated_rel, extra_interim_csvs=extras)
            
        # ============================================================
        # UPLOAD (validated scoring CSVs to Azure when runtime.upload_azure is true)
        # ============================================================
        upload_validated = UploadValidated(self.config_path)
        upload_validated.upload()

        # ============================================================
        # PROCESS (indicator progress projections -> data/processed/)
        # Projections are not enabled for the MVP contract. Post-MVP owner:
        # Anthony / Thomas.
        # ============================================================
        # processData = ProcessData(self.config_path)
        # processData.process()
        
         # ============================================================
        # UPLOAD PROCESSED (indicator progress projections -> data/processed/)
        # ============================================================
        # upload_processed = UploadProcessed(self.config_path)
        # upload_processed.upload()
        

        '''

        Method A: Store to Storage (Local/Azure Blob)

        Pros:
        Lower memory footprint - data is offloaded after each stage
        Fault tolerance - if a stage fails, previous results are persisted
        Easier debugging - can inspect intermediate files
        Supports resumable pipelines

        Cons:
        Slower - I/O operations (read/write) add latency
        More Azure Blob transactions = higher cost
        Serialization/deserialization overhead (JSON parsing, etc.)


        Method B: Pass via Variable (In-Memory)

        Pros:
        Faster - no I/O overhead
        No storage transaction costs
        Data stays in native Python format (no serialization)

        Cons:
        Higher peak memory usage - all data in RAM simultaneously
        If pipeline fails mid-way, you lose everything
        Harder to debug intermediate states

        '''
        
        