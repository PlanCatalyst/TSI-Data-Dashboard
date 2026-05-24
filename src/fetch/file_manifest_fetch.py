from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from src.pipeline.utils import ensure_dir, setup_logger
from src.pipeline.terminal_output import TerminalOutput

from .base_fetch import DataFetcher


class FileManifestFetcher(DataFetcher):
    """
    Generic fetcher for sources published as one or more bulk files downloaded
    by URL (CSV, XLSX, ZIP, ...). Handles the download loop, per-file retry,
    error capture, progress logging, and manifest persistence.

    The manifest is the contract between the fetcher and the matching cleaner:
    one record per file with `alias`, `url`, `version`, `local_path`,
    `content_length`, `http_status`, `indicators` (the per-file indicator
    specs the cleaner consumes), and `error` if the download failed.

    Source-specific subclasses (UNDPHDRFetcher, WBWGIFetcher) inherit this
    behaviour unchanged today. Override `_download` to add per-source quirks
    like custom headers or auth without restructuring the manifest contract.
    """

    # Progress prefix shown in terminal output; override per source.
    progress_prefix: str = "files"

    def __init__(self, base: str, credentials: Optional[dict] = None, **kwargs):
        super().__init__(base, credentials, **kwargs)
        self.session = requests.Session()
        self.log = setup_logger()

    def save_raw_data(self, records: List[Dict[str, Any]], out_dir: Path, filename: str) -> None:
        """
        Persist the manifest JSON. The actual file bytes are written by
        `fetch_indicator_data`; this method documents what landed where.
        """
        ensure_dir(out_dir)
        (out_dir / filename).write_text(json.dumps(records, indent=2), encoding="utf-8")

    def fetch_indicator_data(
        self,
        files: List[Dict[str, Any]],
        out_dir: Path,
    ) -> List[Dict[str, Any]]:
        """
        Download each configured file and return a manifest list.

        Args:
            files: list of {alias, url, version, indicators:[...]} dicts.
            out_dir: per-source raw directory (e.g. data/raw/undp-hdr/).

        Returns:
            List of manifest records. Failed downloads carry `error` and a
            None `local_path` so the cleaner can skip them without crashing.
        """
        ensure_dir(out_dir)
        manifest: List[Dict[str, Any]] = []
        source_root = out_dir.parents[1]  # data/raw/ — for relative paths

        for idx, spec in enumerate(files or [], 1):
            alias = spec.get("alias")
            url = spec.get("url")
            if not alias or not url:
                TerminalOutput.info(f"skipping malformed {self.progress_prefix} spec at index {idx}", indent=1)
                continue

            suffix = Path(url).suffix or ".csv"
            local_path = out_dir / f"{alias}{suffix}"

            TerminalOutput.print_progress(idx, len(files), prefix=f"  {self.progress_prefix} {alias}: ")
            base_record = {
                "alias": alias,
                "url": url,
                "version": spec.get("version"),
                "format": spec.get("format"),
                "indicators": spec.get("indicators", []),
            }
            try:
                resp = self._download(url)
                local_path.write_bytes(resp.content)
                manifest.append({
                    **base_record,
                    "local_path": str(local_path.relative_to(source_root)),
                    "content_length": len(resp.content),
                    "http_status": resp.status_code,
                })
            except Exception as exc:
                TerminalOutput.info(f"  failed {alias}: {exc}", indent=1)
                manifest.append({
                    **base_record,
                    "local_path": None,
                    "content_length": 0,
                    "http_status": None,
                    "error": str(exc),
                })

        TerminalOutput.summary(
            "  Files",
            f"{sum(1 for m in manifest if m.get('local_path'))} / {len(manifest)} downloaded",
        )
        return manifest

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, max=8))
    def _download(self, url: str) -> requests.Response:
        """HTTP GET with retry. Override to add per-source headers or auth."""
        r = self.session.get(url, timeout=60)
        r.raise_for_status()
        return r
