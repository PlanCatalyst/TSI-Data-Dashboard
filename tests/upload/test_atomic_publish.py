"""PR C: atomic publish — payload files first, meta.json last."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.projections import GATE_REASONS, UX_UNAVAILABLE_COPY, validate_payload
from src.upload.atomic import RecordingUploader, upload_payloads_then_meta
from src.upload.publish_dashboard import apply_projections_meta


PREFIX = "v1/"


def _upload_pair(name: str, body: bytes = b"{}") -> tuple[str, bytes]:
    return name, body


def test_meta_written_last_on_success():
    fake = RecordingUploader()
    written = upload_payloads_then_meta(
        fake,
        prefix=PREFIX,
        payload_files=[
            _upload_pair("countries.json", b"[1]"),
            _upload_pair("timeseries.json", b"{2}"),
            _upload_pair("projections.json", b"[3]"),
        ],
        meta_name="meta.json",
        meta_bytes=b'{"ok":true}',
    )
    assert written == [
        "v1/countries.json",
        "v1/timeseries.json",
        "v1/projections.json",
        "v1/meta.json",
    ]
    assert fake.written == written
    assert fake.written[-1] == "v1/meta.json"
    assert "v1/meta.json" in fake.payloads


def test_meta_not_written_if_mid_payload_fails():
    fake = RecordingUploader(fail_on="v1/timeseries.json")
    with pytest.raises(RuntimeError, match="timeseries"):
        upload_payloads_then_meta(
            fake,
            prefix=PREFIX,
            payload_files=[
                _upload_pair("countries.json", b"[1]"),
                _upload_pair("timeseries.json", b"{2}"),
                _upload_pair("projections.json", b"[3]"),
            ],
            meta_name="meta.json",
            meta_bytes=b'{"ok":true}',
        )
    assert fake.written == ["v1/countries.json"]
    assert "v1/meta.json" not in fake.written
    assert "v1/projections.json" not in fake.written
    assert "v1/timeseries.json" not in fake.written


def test_meta_not_written_if_first_payload_fails():
    fake = RecordingUploader(fail_on="v1/countries.json")
    with pytest.raises(RuntimeError, match="countries"):
        upload_payloads_then_meta(
            fake,
            prefix=PREFIX,
            payload_files=[
                _upload_pair("countries.json"),
                _upload_pair("timeseries.json"),
            ],
            meta_name="meta.json",
            meta_bytes=b"{}",
        )
    assert fake.written == []
    assert "v1/meta.json" not in fake.written


def test_meta_not_written_if_projections_payload_fails():
    fake = RecordingUploader(fail_on="v1/projections.json")
    with pytest.raises(RuntimeError, match="projections"):
        upload_payloads_then_meta(
            fake,
            prefix=PREFIX,
            payload_files=[
                _upload_pair("countries.json"),
                _upload_pair("timeseries.json"),
                _upload_pair("projections.json"),
            ],
            meta_name="meta.json",
            meta_bytes=b"{}",
        )
    assert fake.written == ["v1/countries.json", "v1/timeseries.json"]
    assert "v1/meta.json" not in fake.written


def test_publish_wires_validated_projection_rows_and_meta_last():
    """Full publish() path with fake uploader: §8 validate + meta last."""
    from src.upload.publish_dashboard import publish
    from src.pipeline.utils import project_root

    rows = [
        {
            "iso3": "KEN",
            "indicator_code": "EN.POP.DNST",
            "year": 2025,
            "value": 10.0,
            "value_lo": 8.0,
            "value_hi": 12.0,
            "status": "forecast",
            "record_type": "forecast",
            "unavailable_reason": None,
        },
        {
            "iso3": "SSD",
            "indicator_code": "EN.POP.DNST",
            "year": 2025,
            "value": None,
            "value_lo": None,
            "value_hi": None,
            "status": "unavailable",
            "record_type": "unavailable",
            "unavailable_reason": "insufficient_observations",
        },
    ]
    # Precondition: A's validator accepts these rows.
    validate_payload(rows)
    assert rows[1]["unavailable_reason"] in GATE_REASONS
    assert UX_UNAVAILABLE_COPY == "Forecast unavailable due to insufficient information."

    root = project_root()
    # Need validated CSVs present for publish builders.
    validated = root / "data" / "interim" / "validated"
    if not (validated / "pillarscores.csv").exists():
        pytest.skip("validated scoring CSVs not present locally")

    fake = RecordingUploader()
    publish(
        repo_root=root,
        pipeline_run_id="test-atomic",
        dry_run=False,
        projection_rows=rows,
        enable_projections=True,
        upload_fn=fake,
    )

    assert fake.written[0].endswith("countries.json")
    assert fake.written[1].endswith("timeseries.json")
    assert fake.written[2].endswith("projections.json")
    assert fake.written[3].endswith("meta.json")
    # manifest is bookkeeping after meta
    assert any(w.endswith("manifest.json") for w in fake.written)
    meta_idx = next(i for i, w in enumerate(fake.written) if w.endswith("meta.json"))
    proj_idx = next(i for i, w in enumerate(fake.written) if w.endswith("projections.json"))
    assert proj_idx < meta_idx

    import json

    meta = json.loads(fake.payloads[fake.written[meta_idx]])
    assert meta["projections"]["enabled"] is True
    assert meta["projections"]["firstProjectedYear"] == 2025
    # Note copy must not be invented / rewritten by PR C.
    assert meta["projections"]["note"] == "Projection band coming soon."


def test_apply_projections_meta_flips_enabled_only():
    meta = {
        "projections": {
            "enabled": False,
            "firstProjectedYear": None,
            "note": "Projection band coming soon.",
        }
    }
    rows = [
        {
            "iso3": "KEN",
            "indicator_code": "uhc",
            "year": 2027,
            "value": 1.0,
            "value_lo": 0.5,
            "value_hi": 1.5,
            "status": "forecast",
            "record_type": "forecast",
            "unavailable_reason": None,
        }
    ]
    out = apply_projections_meta(meta, rows, enable=True)
    assert out["projections"]["enabled"] is True
    assert out["projections"]["firstProjectedYear"] == 2027
    assert out["projections"]["note"] == "Projection band coming soon."


def test_publish_skips_meta_when_projections_upload_fails(monkeypatch):
    """If projections.json fails mid-publish, meta.json must not be written."""
    from src.upload import publish_dashboard as pd_mod
    from src.pipeline.utils import project_root

    root = project_root()
    validated = root / "data" / "interim" / "validated"
    if not (validated / "pillarscores.csv").exists():
        pytest.skip("validated scoring CSVs not present locally")

    rows = [
        {
            "iso3": "KEN",
            "indicator_code": "EN.POP.DNST",
            "year": 2025,
            "value": 10.0,
            "value_lo": 8.0,
            "value_hi": 12.0,
            "status": "forecast",
            "record_type": "forecast",
            "unavailable_reason": None,
        }
    ]
    fake = RecordingUploader(fail_on="v1/projections.json")
    with pytest.raises(RuntimeError, match="projections"):
        pd_mod.publish(
            repo_root=root,
            pipeline_run_id="test-fail-mid",
            dry_run=False,
            projection_rows=rows,
            upload_fn=fake,
        )
    assert any(w.endswith("countries.json") for w in fake.written)
    assert any(w.endswith("timeseries.json") for w in fake.written)
    assert not any(w.endswith("meta.json") for w in fake.written)


def test_publish_meta_last_with_mocked_builders(monkeypatch):
    """publish() upload order without needing validated CSVs on disk."""
    from src.upload import publish_dashboard as pd_mod

    class FakeInputs:
        pass

    meta = {
        "schemaVersion": "1.0.0",
        "generatedAt": "2026-01-01T00:00:00+00:00",
        "pipelineRunId": "t",
        "scoringDirection": "higher_is_better",
        "years": [2020],
        "projections": {
            "enabled": False,
            "firstProjectedYear": None,
            "note": "Projection band coming soon.",
        },
        "regions": [],
        "pillars": [],
        "subdomains": [],
        "indicators": [],
    }
    countries = [{"iso3": "KEN"}]
    timeseries = {"KEN": {"uhc": [None]}}
    rows = [
        {
            "iso3": "KEN",
            "indicator_code": "uhc",
            "year": 2025,
            "value": 1.0,
            "value_lo": 0.5,
            "value_hi": 1.5,
            "status": "forecast",
            "record_type": "forecast",
            "unavailable_reason": None,
        }
    ]

    monkeypatch.setattr(pd_mod, "load_inputs", lambda *a, **k: FakeInputs())
    monkeypatch.setattr(pd_mod, "build_meta", lambda inputs: dict(meta))
    monkeypatch.setattr(pd_mod, "build_countries", lambda inputs: countries)
    monkeypatch.setattr(pd_mod, "build_timeseries", lambda inputs: timeseries)
    monkeypatch.setattr(pd_mod, "validate_payload", lambda *a, **k: None)

    fake = RecordingUploader()
    pd_mod.publish(
        repo_root=Path("."),
        pipeline_run_id="mock-run",
        dry_run=False,
        projection_rows=rows,
        enable_projections=True,
        upload_fn=fake,
    )
    names = [w.split("/", 1)[-1] for w in fake.written if w.startswith("v1/")]
    # countries, timeseries, projections, meta, then optional manifest
    assert names[:4] == [
        "countries.json",
        "timeseries.json",
        "projections.json",
        "meta.json",
    ]


def test_publish_mid_fail_skips_meta_with_mocked_builders(monkeypatch):
    from src.upload import publish_dashboard as pd_mod

    meta = {
        "schemaVersion": "1.0.0",
        "generatedAt": "2026-01-01T00:00:00+00:00",
        "pipelineRunId": "t",
        "scoringDirection": "higher_is_better",
        "years": [2020],
        "projections": {
            "enabled": False,
            "firstProjectedYear": None,
            "note": "Projection band coming soon.",
        },
        "regions": [],
        "pillars": [],
        "subdomains": [],
        "indicators": [],
    }
    rows = [
        {
            "iso3": "KEN",
            "indicator_code": "uhc",
            "year": 2025,
            "value": None,
            "value_lo": None,
            "value_hi": None,
            "status": "unavailable",
            "record_type": "unavailable",
            "unavailable_reason": "insufficient_observations",
        }
    ]
    monkeypatch.setattr(pd_mod, "load_inputs", lambda *a, **k: object())
    monkeypatch.setattr(pd_mod, "build_meta", lambda inputs: dict(meta))
    monkeypatch.setattr(pd_mod, "build_countries", lambda inputs: [])
    monkeypatch.setattr(pd_mod, "build_timeseries", lambda inputs: {})
    monkeypatch.setattr(pd_mod, "validate_payload", lambda *a, **k: None)

    fake = RecordingUploader(fail_on="v1/timeseries.json")
    with pytest.raises(RuntimeError, match="timeseries"):
        pd_mod.publish(
            repo_root=Path("."),
            pipeline_run_id="mock-fail",
            dry_run=False,
            projection_rows=rows,
            upload_fn=fake,
        )
    assert fake.written == ["v1/countries.json"]
    assert not any(w.endswith("meta.json") for w in fake.written)
