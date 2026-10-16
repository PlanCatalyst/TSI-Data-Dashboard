"""PIPELINE_UPLOAD_AZURE=false must stop the validated upload even when
settings.yaml says upload_azure: true (the orchestrator passes its resolved
runtime in)."""

from __future__ import annotations

from pathlib import Path

import pytest

import src.upload.upload_validated as uv


def _config(tmp_path: Path) -> Path:
    p = tmp_path / "settings.yaml"
    p.write_text("runtime:\n  upload_azure: true\nazure:\n  container_name: validated-scores\n", encoding="utf-8")
    return p


@pytest.fixture
def azure_on(monkeypatch):
    monkeypatch.setattr(uv, "azure_configured", lambda: True)
    monkeypatch.setattr(uv, "blob_credential", lambda: object())
    monkeypatch.setattr(uv, "credential_kind", lambda: "test")

    def _no_azure(*args, **kwargs):
        raise AssertionError("Azure client created while upload_azure is false")

    monkeypatch.setattr(uv, "BlobServiceClient", _no_azure)


def test_resolved_runtime_overrides_yaml(tmp_path, azure_on):
    up = uv.UploadValidated(_config(tmp_path), runtime={"upload_azure": False})
    assert up.runtime["upload_azure"] is False
    up.upload()


def test_yaml_runtime_used_without_override(tmp_path, azure_on):
    up = uv.UploadValidated(_config(tmp_path))
    assert up.runtime["upload_azure"] is True
