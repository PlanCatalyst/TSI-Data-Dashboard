"""Where the ND-GAIN ZIP comes from (requirements v2, REQ3.3).

Local default: the path in settings.yaml ndgain.zip_path.base. In the Azure
job, NDGAIN_BLOB_CONTAINER names a private container and the newest .zip under
the prefix is downloaded and used. The chosen file is always logged so the
run output says which source version produced the snapshot.
"""
from __future__ import annotations

import os
import zipfile
from pathlib import Path
from typing import Callable

from src.upload.azure_credential import account_url, azure_configured, blob_credential


class NdgainSourceError(RuntimeError):
    """Raised when no usable ND-GAIN ZIP can be resolved. The message names
    the ND-GAIN stage so the pipeline failure line does too (AC3.3)."""


def resolve_ndgain_zip(cfg: dict, root: Path, log: Callable[[str], None] = print) -> Path:
    nd = cfg.get("ndgain") or {}
    local = root / (nd.get("zip_path") or {}).get("base", "data/raw/nd-gain/ndgain_countryindex.zip")
    blob_cfg = nd.get("blob") or {}
    container = os.getenv("NDGAIN_BLOB_CONTAINER") or blob_cfg.get("container") or ""
    prefix = os.getenv("NDGAIN_BLOB_PREFIX") or blob_cfg.get("prefix") or "sources/ndgain/"

    if not container or not azure_configured():
        log(f"ND-GAIN source: local file {local}")
        return _validated(local)

    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient(account_url(), credential=blob_credential()).get_container_client(container)
    zips = [b for b in client.list_blobs(name_starts_with=prefix) if b.name.lower().endswith(".zip")]
    if not zips:
        raise NdgainSourceError(f"ND-GAIN stage: no .zip found under {container}/{prefix}")
    newest = max(zips, key=lambda b: (b.last_modified, b.name))

    dest = local.parent / Path(newest.name).name
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as fh:
        client.download_blob(newest.name).readinto(fh)
    stamp = newest.last_modified.strftime("%Y-%m-%d %H:%M UTC") if newest.last_modified else "unknown date"
    log(f"ND-GAIN source: {container}/{newest.name} (last modified {stamp}, {newest.size} bytes)")
    return _validated(dest)


def _validated(path: Path) -> Path:
    if not path.exists():
        raise NdgainSourceError(f"ND-GAIN stage: file not found at {path}")
    if not zipfile.is_zipfile(path):
        raise NdgainSourceError(f"ND-GAIN stage: {path.name} is not a valid ZIP archive")
    return path
