"""Atomic blob publish helpers: payload files first, meta.json last.

Frontend readiness is keyed off ``meta.json`` (see ``dashboard/src/data/
contract/loaders.ts`` HEAD check). A mid-payload failure must leave the
previous live ``meta.json`` untouched so readers never observe a partial
snapshot.
"""

from __future__ import annotations

from typing import Any, Callable, Optional, Protocol, Sequence

# Content-settings type is opaque here so tests can pass None / simple stubs.
UploadFn = Callable[[str, bytes, Any], None]


class SupportsUploadBlob(Protocol):
    def upload_blob(
        self, data: bytes, *, overwrite: bool = True, content_settings: Any = None
    ) -> Any: ...


class SupportsBlobClient(Protocol):
    def get_blob_client(self, blob: str) -> SupportsUploadBlob: ...


def upload_payloads_then_meta(
    upload: UploadFn,
    *,
    prefix: str,
    payload_files: Sequence[tuple[str, bytes]],
    meta_name: str,
    meta_bytes: bytes,
    payload_content_settings: Any = None,
    meta_content_settings: Any = None,
) -> list[str]:
    """Upload every payload blob, then ``meta.json`` last.

    Parameters
    ----------
    upload:
        ``upload(blob_name, data, content_settings)`` — raises on failure.
    prefix:
        Version prefix, e.g. ``\"v1/\"``.
    payload_files:
        Ordered ``(filename, bytes)`` pairs **excluding** meta. Typical order:
        ``countries.json``, ``timeseries.json``, optional ``projections.json``.
    meta_name / meta_bytes:
        Readiness marker written only after every payload succeeds.

    Returns
    -------
    list[str]
        Full blob names written, in order (payloads then meta).
    """
    written: list[str] = []
    for name, data in payload_files:
        blob_name = prefix + name
        upload(blob_name, data, payload_content_settings)
        written.append(blob_name)

    meta_blob = prefix + meta_name
    upload(meta_blob, meta_bytes, meta_content_settings)
    written.append(meta_blob)
    return written


def azure_container_uploader(container: SupportsBlobClient) -> UploadFn:
    """Adapt an Azure container client to the ``UploadFn`` signature."""

    def _upload(blob_name: str, data: bytes, content_settings: Any) -> None:
        kwargs: dict[str, Any] = {"overwrite": True}
        if content_settings is not None:
            kwargs["content_settings"] = content_settings
        container.get_blob_client(blob_name).upload_blob(data, **kwargs)

    return _upload


class RecordingUploader:
    """In-memory fake blob client for atomicity tests."""

    def __init__(self, *, fail_on: Optional[str] = None) -> None:
        self.fail_on = fail_on
        self.written: list[str] = []
        self.payloads: dict[str, bytes] = {}

    def __call__(self, blob_name: str, data: bytes, content_settings: Any = None) -> None:
        if self.fail_on is not None and blob_name == self.fail_on:
            raise RuntimeError(f"simulated upload failure for {blob_name}")
        self.written.append(blob_name)
        self.payloads[blob_name] = data
