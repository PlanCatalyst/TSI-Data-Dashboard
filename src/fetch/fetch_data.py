'''
This module fetches data from all sources.

Responsible for fetching and structuring data from all sources.
'''

from __future__ import annotations

import sys
import logging
import yaml
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

from src.fetch.fetch_factory import DataFetcherFactory
from src.fetch.fetch_handler import FetchHandlerConfig
from src.pipeline.utils import project_root, setup_logger
from src.pipeline.terminal_output import fetch_header, TerminalOutput


def _unsdg_dimension_fetch_specs(
    indicator_codes: List[str],
    classes_path: Path,
) -> List[Dict[str, Any]]:
    """
    Build specs for indicators that must be fetched per dimension (API returns
    correct dimension only when filtered). Reads unsdg_indicator_classes.yaml.

    Returns a list of dicts: {"indicator", "dimension_name", "dimension_values"}.
    """
    if not classes_path.exists():
        return []
    with open(classes_path, "r") as f:
        config = yaml.safe_load(f) or {}
    indicator_classes = config.get("indicator_classes") or {}
    specs = []
    for code in indicator_codes:
        entry = indicator_classes.get(code)
        if not entry or not entry.get("fetch_by_dimension"):
            continue
        dim_field = entry.get("dimension_field")
        if not dim_field or dim_field == "series_code":
            continue
        classes = entry.get("classes") or {}
        dimension_values = list(classes.keys())
        if not dimension_values:
            continue
        specs.append({
            "indicator": code,
            "dimension_name": dim_field,
            "dimension_values": dimension_values,
        })
    return specs


def _source_raw_dir(cfg: Dict[str, Any], source_key: str) -> Path:
    """
    Return source-specific raw output directory.
    Falls back to paths.data_raw if paths_by_source.raw is not configured.
    """
    by_source = (cfg.get("paths_by_source") or {}).get("raw") or {}
    source_rel = by_source.get(source_key)
    if source_rel:
        return project_root() / source_rel
    return project_root() / (cfg.get("paths", {}).get("data_raw", "data/raw/"))


class FetchData:
    """
    Essentially the main of the module.
    """

    def __init__(self, config_path):

        self.config_path = config_path
        self.log = logging.getLogger(__name__)

    def fetch(self) -> Dict[str, list]:
        """
        Fetch data from all sources.
        Returns a dictionary containing all the fetched data.
        """

        # Path to your configuration file
        cfg_path = Path(self.config_path)

        # Stop if config file is missing
        if not cfg_path.exists():
            self.log.error("Missing config at %s", cfg_path)
            sys.exit(1)

        # Create Data Fetcher Factory
        fetcher_factory = DataFetcherFactory(config_path=cfg_path)
        
        # Load full configuration file
        cfg = fetcher_factory.get_config()  
        paths, runtime = cfg["paths"], cfg["runtime"]
        raw_files = runtime.get("raw_files", {})

        """ ################################################################## 
        ### UN SDG FETCHING ###
        ################################################################## """
        
        fetch_header("UN SDG")
        
        # Build FetchHandlerConfig from settings for robust retry handling
        unsdg_settings = cfg.get('unsdg', {}).get('settings', {})
        handler_config = FetchHandlerConfig(
            timeout=unsdg_settings.get('request_timeout', 60),
            max_retries=unsdg_settings.get('max_retries', 8),
            initial_backoff=unsdg_settings.get('initial_backoff', 2.0),
            max_backoff=unsdg_settings.get('max_backoff', 120.0),
            backoff_multiplier=unsdg_settings.get('backoff_multiplier', 2.0),
            delay_between_requests=unsdg_settings.get('delay_between_requests', 0.5),
        )
        
        unsdgClient = fetcher_factory.create_client('unsdg', handler_config=handler_config)
        
        unsdg_indicator_data_endpoint = cfg['unsdg']['api_paths']['indicator_data_endpoint']
        unsdg_indicator_codes = [indicator['code'] for indicator in cfg['unsdg']['indicators']]
        
        TerminalOutput.info(f"Fetching {len(unsdg_indicator_codes)} indicators", indent=1)

        start_year = cfg['unsdg']['start_year']
        end_year = cfg['unsdg']['end_year']
        time_period_array = list(range(start_year, end_year + 1))
        per_page = cfg['runtime']['per_page']

        # Build list of indicators that must be fetched per dimension (API returns correct
        # dimension only when filtered). Config: unsdg_indicator_classes.yaml, fetch_by_dimension: true.
        dimension_fetch_specs = _unsdg_dimension_fetch_specs(
            unsdg_indicator_codes,
            project_root() / "src" / "config" / "unsdg_indicator_classes.yaml",
        )
        bulk_indicators = [c for c in unsdg_indicator_codes if c not in {s["indicator"] for s in dimension_fetch_specs}]

        main_list: List[Dict[str, Any]] = []
        if bulk_indicators:
            indicator_data_dict = unsdgClient.fetch_indicator_data(
                unsdg_indicator_data_endpoint,
                parameters={
                    "indicator": bulk_indicators,
                    "timePeriod": time_period_array,
                    "page": 1,
                    "pageSize": per_page,
                },
                dimension_filters=cfg['unsdg'].get('dimension_filters', None),
            )
            main_list = indicator_data_dict["data"]

        for spec in dimension_fetch_specs:
            records = unsdgClient.fetch_indicator_by_dimension(
                unsdg_indicator_data_endpoint,
                indicator_code=spec["indicator"],
                dimension_name=spec["dimension_name"],
                dimension_values=spec["dimension_values"],
                time_period_array=time_period_array,
                page_size=per_page,
            )
            main_list = main_list + records

        unsdg_indicator_list = main_list

        # Save raw data locally
        if runtime.get("save_raw", True):
            unsdg_csv_path = _source_raw_dir(cfg, "unsdg")
            unsdgClient.save_raw_data(
                unsdg_indicator_list, 
                unsdg_csv_path,
                raw_files.get("unsdg", "un_sdg_raw.json")
            )
        
        """ ################################################################## 
        ### WORLD BANK FETCHING ###
        ################################################################## """

        fetch_header("World Bank")

        wbClient = fetcher_factory.create_client('worldbank')
        
        wb = cfg["worldbank"]
        recs = []

        TerminalOutput.info(f"Fetching {len(wb['indicators'])} indicators", indent=1)
        for ind in wb["indicators"]:
            code, alias = ind["code"], ind.get("alias", ind["code"])

            # Fetch all records (2010–2024, all countries)
            # NOTE: Countries are aggregated into income classification groups because we're using 'all'
            # e.g. High income, low income, lower middle, etc.
            # This is done by the API

            # fetch_indicator_data() returns a LIST of indicator records
            recs.extend(wbClient.fetch_indicator_data(code, 
                wb["countries"], 
                wb["start_year"], 
                wb["end_year"]
            ))

        # Save raw data locally
        # Saves recs – a LIST of indicator records
        if runtime.get("save_raw", True):
            wbClient.save_raw_data(
                recs,
                _source_raw_dir(cfg, "worldbank"),
                raw_files.get("worldbank", "world_bank_raw.json")
            )
        
        
        """ ################################################################## 
        ### ND-GAIN FETCHING ###
        ################################################################## """
        
        fetch_header("ND-GAIN")
        
        ndGainClient = fetcher_factory.create_client('ndgain')
        
        ndgain_vulnerability_indicators = cfg['ndgain']['indicators']['vulnerability']
        
        # Get vulnerability scores as a list of dictionaries
        # fetch_indicator_data() returns a LIST of indicator records
        ndgain_indicator_scores = ndGainClient.fetch_indicator_data(
            indicator_codes=ndgain_vulnerability_indicators, 
            chunkSize=cfg['runtime']['chunk_size']
        )
        
        # Save raw data locally (JSON record payload extracted from ZIP components)
        if runtime.get("save_raw", True):
            ndGainClient.save_raw_data(
                ndgain_indicator_scores,
                _source_raw_dir(cfg, "ndgain"),
                raw_files.get("ndgain", "nd_gain_raw.json")
            )
        
        """ ##################################################################
        ### UNDP HDR FETCHING ###
        ################################################################## """

        fetch_header("UNDP HDR")

        undp_cfg = cfg.get("undp_hdr") or {}
        undp_files = undp_cfg.get("files") or []
        undp_manifest: List[Dict[str, Any]] = []
        if undp_files:
            undpClient = fetcher_factory.create_client("undp_hdr")
            undp_out_dir = _source_raw_dir(cfg, "undp_hdr")
            TerminalOutput.info(f"Downloading {len(undp_files)} HDR files", indent=1)
            undp_manifest = undpClient.fetch_indicator_data(undp_files, undp_out_dir)

            if runtime.get("save_raw", True):
                undpClient.save_raw_data(
                    undp_manifest,
                    undp_out_dir,
                    raw_files.get("undp_hdr", "undp_hdr_manifest.json"),
                )
        else:
            TerminalOutput.info("No UNDP HDR files configured; skipping", indent=1)

        """ ##################################################################
        ### WORLD BANK WGI FETCHING ###
        ################################################################## """

        fetch_header("World Bank WGI")

        wgi_cfg = cfg.get("wb_wgi") or {}
        wgi_files = wgi_cfg.get("files") or []
        wgi_manifest: List[Dict[str, Any]] = []
        if wgi_files:
            wgiClient = fetcher_factory.create_client("wb_wgi")
            wgi_out_dir = _source_raw_dir(cfg, "wb_wgi")
            TerminalOutput.info(f"Downloading {len(wgi_files)} WGI files", indent=1)
            wgi_manifest = wgiClient.fetch_indicator_data(wgi_files, wgi_out_dir)

            if runtime.get("save_raw", True):
                wgiClient.save_raw_data(
                    wgi_manifest,
                    wgi_out_dir,
                    raw_files.get("wb_wgi", "wb_wgi_manifest.json"),
                )
        else:
            TerminalOutput.info("No WGI files configured; skipping", indent=1)

        print("\n" + "="*60)
        TerminalOutput.complete("All data sources fetched successfully")
        print("="*60 + "\n")

        # Return a dictionary containing all the fetched data
        return {
            "unsdg": unsdg_indicator_list,
            "worldbank": recs,
            "ndgain": ndgain_indicator_scores,
            "undp_hdr": undp_manifest,
            "wb_wgi": wgi_manifest,
        }


if __name__ == "__main__":
    fetchData = FetchData("src/config/settings.yaml")
    fetchData.fetch()
    