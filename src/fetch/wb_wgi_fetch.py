from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from src.pipeline.utils import ensure_dir, setup_logger
from src.pipeline.terminal_output import TerminalOutput

from .base_fetch import DataFetcher


class WBWGIFetcher(DataFetcher):
    """
    World Bank Worldwide Governance Indicators (WGI) data fetcher.

    WGI was deprecated from the regular World Bank API in 2024 and is now
    published as a per-release bulk XLSX from the WGI homepage. We download
    the file by URL and stage it under data/raw/world-bank/.

    The cleaner picks the right sheet (one of va/pv/ge/rq/rl/cc) per
    configured indicator. Today the only indicator we use is the
    Government Effectiveness sheet (`ge`) as a state-capacity proxy.
    """

    def __init__(self, base: str, credentials: Optional[dict] = None, **kwargs):
        super().__init__(base, credentials, **kwargs)
        self.session = requests.Session()
        self.log = setup_logger()

    def save_raw_data(self, records: List[Dict[str, Any]], out_dir: Path, filename: str) -> None:
        ensure_dir(out_dir)
        (out_dir / filename).write_text(json.dumps(records, indent=2), encoding="utf-8")

    def fetch_indicator_data(
        self,
        files: List[Dict[str, Any]],
        out_dir: Path,
    ) -> List[Dict[str, Any]]:
        """Download each configured WGI file by URL and return a manifest."""
        ensure_dir(out_dir)
        manifest: List[Dict[str, Any]] = []

        for idx, spec in enumerate(files or [], 1):
            alias = spec.get("alias")
            url = spec.get("url")
            if not alias or not url:
                TerminalOutput.info(f"skipping malformed WGI spec at index {idx}", indent=1)
                continue

            suffix = Path(url).suffix or ".xlsx"
            local_path = out_dir / f"{alias}{suffix}"

            TerminalOutput.print_progress(idx, len(files), prefix=f"  WGI {alias}: ")
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

        TerminalOutput.summary(
            "  Files",
            f"{sum(1 for m in manifest if m.get('local_path'))} / {len(manifest)} downloaded",
        )
        return manifest

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, max=8))
    def _download(self, url: str) -> requests.Response:
        r = self.session.get(url, timeout=60)
        r.raise_for_status()
        return r
