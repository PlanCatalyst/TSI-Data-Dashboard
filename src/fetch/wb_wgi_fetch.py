from __future__ import annotations

from .file_manifest_fetch import FileManifestFetcher


class WBWGIFetcher(FileManifestFetcher):
    """
    World Bank Worldwide Governance Indicators (WGI) data fetcher.

    WGI was deprecated from the regular World Bank API in 2024 and is now
    published as a per-release bulk XLSX from the WGI homepage. The cleaner
    picks the right sheet (one of `va, pv, ge, rq, rl, cc`) per configured
    indicator. Today the only indicator we use is the Government
    Effectiveness sheet (`ge`) as a state-capacity proxy.

    Behaviour identical to `FileManifestFetcher` today. Override `_download`
    here if WGI ever requires per-source auth or headers.
    """

    progress_prefix = "WGI"