from __future__ import annotations

from .file_manifest_fetch import FileManifestFetcher


class UNDPHDRFetcher(FileManifestFetcher):
    """
    UNDP Human Development Reports data fetching client.

    The HDR data center publishes per-release static CSV/XLSX files (e.g. the
    Composite Indices time series for HDI/GII/IHDI/GDI, and the OPHI Global
    MPI Table). This client downloads each file configured under
    `undp_hdr.files` in settings.yaml into `data/raw/undp-hdr/<alias>.<ext>`
    and writes a manifest the cleaner consumes.

    Adding a new HDR indicator is a config-only change: add another entry
    under `undp_hdr.files` with the right `format` and `indicators` block.

    Behaviour identical to `FileManifestFetcher` today. Override `_download`
    here if HDR ever requires per-source auth or headers.
    """

    progress_prefix = "UNDP HDR"