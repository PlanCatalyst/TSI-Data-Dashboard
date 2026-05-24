'''
This module cleans data from all sources.
Cleaning involves extracting the relevant data and transforming it into a standardized format.

Cleaned (interim) output is saved locally; upload to Azure Blob is a separate pipeline stage
(see src.upload.upload_validated) and runs only on this validated output, not raw.
'''

 
from __future__ import annotations

import sys
import pandas as pd
from typing import Dict, Optional
from pathlib import Path
import logging
from src.pipeline.terminal_output import clean_header, TerminalOutput

from src.clean.clean_factory import DataCleanFactory


class CleanData:
    """
    Cleans source raw data and writes source-cleaned CSV outputs under data/clean.
    Upload to Blob is handled by the upload stage (see pipeline orchestrator).
    """
    
    def __init__(self, config_path):
        self.config_path = config_path
        self.cleanFactory = DataCleanFactory(self.config_path)
        self.cfg = self.cleanFactory.get_config()
        self.logger = logging.getLogger(__name__)

    def to_wide(df: pd.DataFrame) -> pd.DataFrame:
        return df.pivot_table(
            index=["country_code", "country_name", "year"],
            columns="indicator",
            values="value",
        ).reset_index()

    def clean(self, df: Optional[Dict[str, list]] = None) -> Dict[str, pd.DataFrame]:
        """
        Cleans the raw data and returns a dictionary of DataFrames containing the indicator data.

        Args:
            df: Dictionary containing ALL fetched indicator data by source.
                If None, will load data from /raw directory (for debugging).

        Returns:
            Dictionary containing cleaned indicator data by source
        """
        
        # If no data passed, load from /raw directory (debugging mode)
        if df is None:
            self.logger.info("DEBUGGING MODE – LOADING DATA FROM LOCAL")
            df = self.load_raw_data()

        cfg_path = Path(self.config_path)
        if not cfg_path.exists():
            self.logger.error("Missing config at %s", cfg_path)
            sys.exit(1)

        runtime = self.cfg["runtime"]
        
        """ ################################################################## 
        ### UN SDG CLEANING ###
        ################################################################## """
        
        clean_header("UN SDG")
        
        # Setup
        unsdgCleaner = self.cleanFactory.create_cleaner("unsdg")
        unsdg_raw = df["unsdg"]

        # Clean raw data and save in a DataFrame
        unsdg_cleaned = unsdgCleaner.clean_data(unsdg_raw)

        # Save cleaned CSV locally
        unsdg_csv_path = Path(runtime["interim_data"]["unsdg"])

        if runtime["save_cleaned"]:
            unsdgCleaner.save_interim(unsdg_cleaned, unsdg_csv_path)

        """ ################################################################## 
        ### WORLD BANK CLEANING ###
        ################################################################## """

        clean_header("World Bank")

        # Setup
        wbCleaner = self.cleanFactory.create_cleaner("worldbank")
        wb_raw = df["worldbank"]

        # Clean raw data and save in a DataFrame
        wb_cleaned = wbCleaner.clean_data(wb_raw)

        # Save cleaned CSV locally
        wb_csv_path = Path(runtime["interim_data"]["worldbank"])

        if runtime["save_cleaned"]:
            wbCleaner.save_interim(wb_cleaned, wb_csv_path)

        """ ################################################################## 
        ### ND-GAIN CLEANING ###
        ################################################################## """
        
        clean_header("ND-GAIN")
        
        # Setup
        ndGainClient = self.cleanFactory.create_cleaner("ndgain")
        ndgain_raw = df["ndgain"]

        # Clean raw data and save in a DataFrame
        ndgain_cleaned = ndGainClient.clean_data(ndgain_raw)

        # Save cleaned CSV locally
        ndgain_csv_path = Path(runtime["interim_data"]["ndgain"])

        if runtime["save_cleaned"]:
            ndGainClient.save_interim(ndgain_cleaned, ndgain_csv_path)

        """ ##################################################################
        ### UNDP HDR CLEANING ###
        ################################################################## """

        clean_header("UNDP HDR")

        undp_manifest = (df or {}).get("undp_hdr") or []
        undp_cleaned = pd.DataFrame()
        if undp_manifest:
            undpCleaner = self.cleanFactory.create_cleaner("undp_hdr")
            undp_cleaned = undpCleaner.clean_data(undp_manifest)
            undp_path_rel = (runtime.get("interim_data") or {}).get("undp_hdr")
            if runtime["save_cleaned"] and undp_path_rel and not undp_cleaned.empty:
                undpCleaner.save_interim(undp_cleaned, Path(undp_path_rel))
        else:
            TerminalOutput.info("No UNDP HDR manifest; skipping", indent=1)

        """ ##################################################################
        ### WORLD BANK WGI CLEANING ###
        ################################################################## """

        clean_header("World Bank WGI")

        wgi_manifest = (df or {}).get("wb_wgi") or []
        wgi_cleaned = pd.DataFrame()
        if wgi_manifest:
            wgiCleaner = self.cleanFactory.create_cleaner("wb_wgi")
            wgi_cleaned = wgiCleaner.clean_data(wgi_manifest)
            wgi_path_rel = (runtime.get("interim_data") or {}).get("wb_wgi")
            if runtime["save_cleaned"] and wgi_path_rel and not wgi_cleaned.empty:
                wgiCleaner.save_interim(wgi_cleaned, Path(wgi_path_rel))
        else:
            TerminalOutput.info("No WGI manifest; skipping", indent=1)

        print("\n" + "="*60)
        TerminalOutput.complete("All data sources cleaned successfully")
        print("="*60 + "\n")

        return {
            "unsdg": unsdg_cleaned,
            "worldbank": wb_cleaned,
            "ndgain": ndgain_cleaned,
            "undp_hdr": undp_cleaned,
            "wb_wgi": wgi_cleaned,
        }

    def load_raw_data(self) -> Dict[str, list]:
        """
        Load raw data from data/raw source folders for debugging purposes.
        This allows running CleanData without going through FetchData.
        
        Returns:
            Dictionary containing raw data by source (same format as FetchData.fetch())
        """
        from src.pipeline.utils import project_root
        import json
        
        raw_dir = project_root() / "data" / "raw"
        by_source = (self.cfg.get("paths_by_source") or {}).get("raw") or {}
        raw_files = (self.cfg.get("runtime") or {}).get("raw_files") or {}
        
        # Load UN SDG data
        unsdg_base = project_root() / by_source.get("unsdg", "data/raw/unsdg/")
        unsdg_path = unsdg_base / raw_files.get("unsdg", "un_sdg_raw.json")
        if not unsdg_path.exists():
            # Backward-compatible fallback for older flat raw layout.
            unsdg_path = raw_dir / "un_sdg_raw.json"
        with open(unsdg_path, 'r') as f:
            unsdg_data = json.load(f)
        
        # Load World Bank data
        wb_base = project_root() / by_source.get("worldbank", "data/raw/world-bank/")
        wb_path = wb_base / raw_files.get("worldbank", "world_bank_raw.json")
        if not wb_path.exists():
            wb_path = raw_dir / "world_bank_raw.json"
        with open(wb_path, 'r') as f:
            wb_data = json.load(f)
        
        ndgain_base = project_root() / by_source.get("ndgain", "data/raw/nd-gain/")
        ndgain_path = ndgain_base / raw_files.get("ndgain", "nd_gain_raw.json")
        if not ndgain_path.exists():
            # Backward-compatible fallback for earlier filename.
            ndgain_path = raw_dir / "nd_gain_raw.csv"
        with open(ndgain_path, 'r') as f:
            ndgain_data = json.load(f)

        # UNDP HDR manifest is optional (introduced after the original sources).
        undp_manifest: list = []
        undp_base = project_root() / by_source.get("undp_hdr", "data/raw/undp-hdr/")
        undp_path = undp_base / raw_files.get("undp_hdr", "undp_hdr_manifest.json")
        if undp_path.exists():
            with open(undp_path, 'r') as f:
                undp_manifest = json.load(f)

        wgi_manifest: list = []
        wgi_base = project_root() / by_source.get("wb_wgi", "data/raw/world-bank/")
        wgi_path = wgi_base / raw_files.get("wb_wgi", "wb_wgi_manifest.json")
        if wgi_path.exists():
            with open(wgi_path, 'r') as f:
                wgi_manifest = json.load(f)

        return {
            "unsdg": unsdg_data,
            "worldbank": wb_data,
            "ndgain": ndgain_data,
            "undp_hdr": undp_manifest,
            "wb_wgi": wgi_manifest,
        }

if __name__ == "__main__":
    # For debugging: loads data from /raw directory instead of requiring FetchData
    from src.pipeline.utils import project_root
    config = project_root() / "src" / "config" / "settings.yaml"
    cleanData = CleanData(config)

    # Clean the loaded data
    cleaned_data = cleanData.clean()
    print(f"\nCleaned data sources: {list(cleaned_data.keys())}")

    # Test Azure upload by instantiating UploadValidated in a local scratch script:
    # uploader = UploadValidated(config)
    # uploader.upload()