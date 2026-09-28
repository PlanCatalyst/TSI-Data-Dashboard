from __future__ import annotations

from .file_manifest_fetch import FileManifestFetcher


class WBWGIFetcher(FileManifestFetcher):
    """
    World Bank Worldwide Governance Indicators (WGI) data fetcher.

    WGI was deprecated from the regular World Bank API in 2024 and is now
    published as a per-release bulk XLSX from the WGI homepage. The cleaner
    picks the right sheet (one of `va, pv, ge, rq, rl, cc`) and score column
    per configured indicator. `WGI_GOVEFF` uses the 0-100 score on `ge`;
    `mspi` fragility uses native EST estimates on all six sheets.

    Behaviour identical to `FileManifestFetcher` today. Override `_download`
    here if WGI ever requires per-source auth or headers.
    """

    progress_prefix = "WGI"