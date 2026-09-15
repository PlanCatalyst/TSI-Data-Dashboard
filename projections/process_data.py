"""
Processing stage: writes **projections of indicator progress** under ``data/processed/``.

World Bank raw series only (PR B). Each country×indicator series emits either:
- ``status``/``record_type`` ``"forecast"`` rows with finite ``value_lo`` ≤ ``value_hi``, or
- ``"unavailable"`` rows with a GATE_REASONS ``unavailable_reason`` and null value/lo/hi

Never silently skips a series. Never publishes last-value carry-forward.
Eligibility uses ``src.projections.quality_gates.assess_series`` (via
``forecast_series``). Emitted rows must pass ``validate_payload`` (§8).
UN SDG / ND-GAIN composites are out of scope for this PR.
"""
from __future__ import annotations

from pathlib import Path
import logging
import os
from datetime import datetime, timezone

import pandas as pd
import yaml
from azure.storage.blob import BlobServiceClient
from azure.identity import ClientSecretCredential
from dotenv import load_dotenv

from src.pipeline.utils import project_root
from src.forecasting import forecast_series
from src.projections.validate import validate_payload

# §8 contract fields published to dashboard-public (see docs/data-contract.md).
PROJECTION_CONTRACT_FIELDS: tuple[str, ...] = (
    "iso3",
    "indicator_code",
    "year",
    "value",
    "value_lo",
    "value_hi",
    "status",
    "record_type",
    "unavailable_reason",
)

FORECASTS_RELATIVE_PATH = Path("data/processed/worldbank/forecasts/world_bank_forecasts.csv")


def projection_contract_rows(rows: list[dict]) -> list[dict]:
    """Strip emit rows to §8 fields for ``src.projections.validate_payload`` / publish."""
    out: list[dict] = []
    for r in rows:
        out.append({field: r.get(field) for field in PROJECTION_CONTRACT_FIELDS})
    return out


def load_forecast_rows_from_csv(csv_path: Path) -> list[dict]:
    """Load ProcessData forecast CSV and normalise nulls for §8 validation."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Missing forecasts CSV at {csv_path}")
    df = pd.read_csv(csv_path)
    rows: list[dict] = []
    for _, series in df.iterrows():
        row: dict = {}
        for field in PROJECTION_CONTRACT_FIELDS:
            if field not in series.index:
                row[field] = None
                continue
            val = series[field]
            if pd.isna(val):
                row[field] = None
            elif field == "year":
                row[field] = int(val)
            elif field in ("value", "value_lo", "value_hi"):
                row[field] = float(val)
            else:
                row[field] = str(val)
        rows.append(row)
    return rows


def upload_to_azure(container_client, csv_path: Path, blob_name: str, log) -> None:
    try:
        if not csv_path.exists():
            log.warning(f"CSV file not found: {csv_path}, skipping upload")
            return

        blob_client = container_client.get_blob_client(blob_name)

        with open(csv_path, "rb") as data:
            blob_client.upload_blob(data, overwrite=True)

        log.info(f"Uploaded {csv_path.name} to Azure as {blob_name}")
    except Exception as e:
        log.error(f"Failed to upload {csv_path.name} to Azure: {e}")


def _iso3(code: object) -> str:
    s = str(code).strip().upper()
    if len(s) != 3 or not s.isalpha():
        raise ValueError(f"expected ISO3 country code, got {code!r}")
    return s


class ProcessData:
    """Build indicator progress projections (actuals + forecast rows) for World Bank."""

    def __init__(self, config_path: str):
        self.config_path = Path(config_path)
        self.log = logging.getLogger(__name__)

        if not self.config_path.exists():
            raise FileNotFoundError(f"Missing config at {self.config_path}")

        self.cfg = yaml.safe_load(self.config_path.read_text(encoding="utf-8"))

    def process(self) -> None:
        paths = self.cfg.get("paths", {})
        runtime = self.cfg.get("runtime", {})

        wb_rel = (runtime.get("interim_data") or {}).get("worldbank")
        if not wb_rel:
            raise ValueError("settings.yaml missing runtime.interim_data.worldbank")
        wb_interim_path = project_root() / wb_rel

        processed_root = Path(paths.get("data_processed", "data/processed/")) / "worldbank"
        if not processed_root.is_absolute():
            processed_root = project_root() / processed_root
        actuals_path = processed_root / "actuals" / "world_bank_actuals.csv"
        forecasts_path = processed_root / "forecasts" / "world_bank_forecasts.csv"
        actuals_path.parent.mkdir(parents=True, exist_ok=True)
        forecasts_path.parent.mkdir(parents=True, exist_ok=True)

        if not wb_interim_path.exists():
            raise FileNotFoundError(f"Missing World Bank interim CSV at: {wb_interim_path}")

        wb = pd.read_csv(wb_interim_path)

        needed = {
            "country_code",
            "country_name",
            "year",
            "indicator-code",
            "indicator",
            "value",
        }
        missing = needed - set(wb.columns)
        if missing:
            raise ValueError(f"World Bank interim missing columns: {missing}. Found: {list(wb.columns)}")

        wb = wb.copy()
        wb.loc[:, "year"] = pd.to_numeric(wb["year"], errors="coerce").astype("Int64")
        wb.loc[:, "value"] = pd.to_numeric(wb["value"], errors="coerce")

        generated_at = datetime.now(timezone.utc).isoformat()

        actuals = wb.dropna(
            subset=["country_code", "country_name", "year", "indicator", "value"]
        ).copy()
        actuals["record_type"] = "actual"
        actuals["generated_at"] = generated_at
        actuals = actuals.copy()
        actuals.loc[:, "indicator_code"] = actuals["indicator-code"]

        actuals.to_csv(actuals_path, index=False)
        self.log.info(f"Wrote actuals: {actuals_path} (rows={len(actuals)})")

        forecast_horizon = int(runtime.get("forecast_horizon_years", 5))
        # PR A thresholds live in assess_series; do not use forecast_min_observations stand-ins.
        end_year = int(runtime.get("end_year", 2024))

        group_cols = ["country_code", "country_name", "indicator-code", "indicator"]
        forecast_rows = []
        n_available = 0
        n_unavailable = 0

        for keys, group in actuals.groupby(group_cols, dropna=False):
            country_code, country_name, indicator_code, indicator = keys
            iso3 = _iso3(country_code)
            result = forecast_series(
                group["year"].tolist(),
                group["value"].tolist(),
                horizon=forecast_horizon,
                end_year=end_year,
            )

            if result.available:
                n_available += 1
                for pt in result.points:
                    forecast_rows.append({
                        "iso3": iso3,
                        "country_name": country_name,
                        "indicator_code": indicator_code,
                        "indicator": indicator,
                        "year": int(pt.year),
                        "value": pt.value,
                        "value_lo": pt.value_lo,
                        "value_hi": pt.value_hi,
                        "status": "forecast",
                        "record_type": "forecast",
                        "generated_at": generated_at,
                        "model_name": result.model_name,
                        "unavailable_reason": None,
                    })
            else:
                n_unavailable += 1
                reason = result.unavailable_reason
                # Engine always emits horizon years (never null year), even for empty history.
                for pt in result.points:
                    forecast_rows.append({
                        "iso3": iso3,
                        "country_name": country_name,
                        "indicator_code": indicator_code,
                        "indicator": indicator,
                        "year": int(pt.year),
                        "value": None,
                        "value_lo": None,
                        "value_hi": None,
                        "status": "unavailable",
                        "record_type": "unavailable",
                        "generated_at": generated_at,
                        "model_name": None,
                        "unavailable_reason": reason,
                    })

        # §8 contract check before write — abort rather than publish illegal rows.
        validate_payload(projection_contract_rows(forecast_rows))

        forecasts = pd.DataFrame(forecast_rows)
        # Guardrail: last-value must never appear as a published model.
        if not forecasts.empty and "model_name" in forecasts.columns:
            banned = forecasts["model_name"].dropna().astype(str).str.contains(
                "last_value", case=False, regex=False
            )
            if banned.any():
                raise RuntimeError("last-value model leaked into forecast output")

        forecasts.to_csv(forecasts_path, index=False)
        self.log.info(
            f"Wrote forecasts: {forecasts_path} "
            f"(rows={len(forecasts)}, available_series={n_available}, "
            f"unavailable_series={n_unavailable})"
        )

        load_dotenv()
        tenant = os.getenv("AZURE_TENANT_ID")
        client_id = os.getenv("AZURE_CLIENT_ID")
        secret = os.getenv("AZURE_CLIENT_SECRET")
        account_url = os.getenv("AZURE_STORAGE_ACCOUNT_URL")

        azure_enabled = all([tenant, client_id, secret, account_url]) and runtime.get("upload_azure", False)
        if not azure_enabled:
            self.log.warning("Azure upload disabled (missing creds or runtime.upload_azure is false). Done.")
            return

        credential = ClientSecretCredential(tenant_id=tenant, client_id=client_id, client_secret=secret)
        blob_service = BlobServiceClient(account_url=account_url, credential=credential)

        container_name = runtime.get("azure_container_processed", "unprocessed-data")
        container_client = blob_service.get_container_client(container_name)

        upload_to_azure(container_client, actuals_path, "processed/worldbank/actuals/world_bank_actuals.csv", self.log)
        upload_to_azure(container_client, forecasts_path, "processed/worldbank/forecasts/world_bank_forecasts.csv", self.log)
