from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional
import json

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from src.pipeline.utils import ensure_dir, setup_logger
from src.pipeline.terminal_output import TerminalOutput

from .base_fetch import DataFetcher


class UNDPHDRFetcher(DataFetcher):
    """
    UNDP Human Development Reports data fetching client.

    The HDR data center publishes per-release static CSV/XLSX files (e.g. the
    Composite Indices time series for HDI/GII/IHDI/GDI, and the global MPI
    table). This client downloads each configured file by URL and stages the
    raw bytes under data/raw/undp-hdr/<alias>.csv so downstream cleaning can
    parse them without re-hitting the network.

    Multiple indicators can ride on a single source file (e.g. composite
    indices file carries both gii and hdi). The cleaner is responsible for
    selecting the right columns per series_code.
    """

    def __init__(self, base: str, credentials: Optional[dict] = None, **kwargs):
        super().__init__(base, credentials, **kwargs)
        self.session = requests.Session()
        self.log = setup_logger()

    def save_raw_data(self, records: List[Dict[str, Any]], out_dir: Path, filename: str) -> None:
        """
        Persist a manifest of downloaded file paths (one record per file).
        The actual CSV/XLSX bytes are written next to this manifest by
        fetch_indicator_data; this manifest documents what landed.
        """
        ensure_dir(out_dir)
        (out_dir / filename).write_text(json.dumps(records, indent=2), encoding="utf-8")

    def fetch_indicator_data(
        self,
        files: List[Dict[str, Any]],
        out_dir: Path,
    ) -> List[Dict[str, Any]]:
        """
        Download each configured HDR file and return a manifest list.

        Args:
            files: list of {alias, url, version, indicators:[{series_code, ...}]}
                   dicts from settings.yaml.
            out_dir: per-source raw directory (data/raw/undp-hdr/).

        Returns:
            List of manifest records: {alias, url, version, local_path,
            content_length, http_status, indicators}.
        """
        ensure_dir(out_dir)
        manifest: List[Dict[str, Any]] = []

        for idx, spec in enumerate(files or [], 1):
            alias = spec.get("alias")
            url = spec.get("url")
            if not alias or not url:
                TerminalOutput.info(f"skipping malformed UNDP HDR spec at index {idx}", indent=1)
                continue

            suffix = Path(url).suffix or ".csv"
            local_path = out_dir / f"{alias}{suffix}"

            TerminalOutput.print_progress(idx, len(files), prefix=f"  UNDP HDR {alias}: ")
            try:
                resp = self._download(url)
                local_path.write_bytes(resp.content)
                manifest.append({
                    "alias": alias,
                    "url": url,
                    "version": spec.get("version"),
                    "local_path": str(local_path.relative_to(out_dir.parents[1])),
                    "content_length": len(resp.content),
                    "http_status": resp.status_code,
                    "indicators": spec.get("indicators", []),
                })
            except Exception as exc:
                TerminalOutput.info(f"  failed {alias}: {exc}", indent=1)
                manifest.append({
                    "alias": alias,
                    "url": url,
                    "version": spec.get("version"),
                    "local_path": None,
                    "content_length": 0,
                    "http_status": None,
                    "error": str(exc),
                    "indicators": spec.get("indicators", []),
                })

        TerminalOutput.summary("  Files", f"{sum(1 for m in manifest if m.get('local_path'))} / {len(manifest)} downloaded")
        return manifest

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, max=8))
    def _download(self, url: str) -> requests.Response:
        r = self.session.get(url, timeout=60)
        r.raise_for_status()
        return r