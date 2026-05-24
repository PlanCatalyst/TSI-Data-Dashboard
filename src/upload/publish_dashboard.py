"""
Publish dashboard JSON to Azure Blob.

Run order:
    1. Pipeline writes to data/interim/validated/ (pillar+subdomain CSVs +
       Indicator_Scores_Full.csv).
    2. publish() reads those + indicators/country_codes.csv +
       indicators/indicators.yaml.
    3. Builds meta/countries/timeseries dicts, validates against the contract,
       uploads to the dashboard-public Azure container under /v1/.
    4. Uploads meta.json, countries.json, timeseries.json, then writes
       manifest.json last — a partial upload never marks the snapshot complete.

Usage:
    python -m src.upload.publish_dashboard                          # dry run
    python -m src.upload.publish_dashboard --azure                  # upload to Azure
    python -m src.upload.publish_dashboard --azure --run-id <id>   # with run ID

Conventions:
- All numeric scores in the published JSON are in [0, 100], higher is better.
- null for missing data; never NaN, never 0 as sentinel.
- iso3 is the canonical country join key; id (ISO numeric) is included for
  the TopoJSON map.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from datetime import datetime, timezone

import pandas as pd
import yaml
import json

import os
from dotenv import load_dotenv
from azure.identity import ClientSecretCredential
from azure.storage.blob import BlobServiceClient, ContentSettings


# ---------------------------------------------------------------------------
# Type aliases for the published payloads. These mirror docs/data-contract.md.
# ---------------------------------------------------------------------------

Json = dict[str, Any]
MetaPayload = Json
CountriesPayload = list[Json]
TimeseriesPayload = dict[str, dict[str, list[Optional[float]]]]

CONTRACT_VERSION = "1.0.0"
PUBLISH_PREFIX_DEFAULT = "v1/"
DASHBOARD_CONTAINER_DEFAULT = "dashboard-public"
SCORING_DIRECTION = "higher_is_better"

_REGIONS = [
    {"code": "afe", "label": "Africa Eastern & Southern"},
    {"code": "afw", "label": "Africa Western & Central"},
    {"code": "eap", "label": "East Asia & Pacific"},
    {"code": "eca", "label": "Europe & Central Asia"},
    {"code": "lcr", "label": "Latin America & Caribbean"},
    {"code": "mna", "label": "Middle East & North Africa"},
    {"code": "sar", "label": "South Asia"},
    {"code": "nam", "label": "North America"},
]

_PILLAR_DISPLAY: dict[str, dict] = {
    "health":  {"color": "#0079c1", "repIndicator": "uhc"},
    "ag":      {"color": "#7a9a1f", "repIndicator": "food"},
    "si":      {"color": "#435d7f", "repIndicator": "water"},
    "women":   {"color": "#817d77", "repIndicator": "gii"},
    "climate": {"color": "#7a6a30", "repIndicator": "ndgain"},
    "ctx":     {"color": "#a05020", "repIndicator": "state"},
    "pri":     {"color": "#3a5a6a", "repIndicator": "conces"},
}

# rawDirection describes the raw measurement, not the scored value.
# "lower_is_better" = raw metric is a rate/burden where higher = worse.
# "higher_is_better" = raw metric is a proportion/index where higher = better.
_RAW_DIRECTIONS: dict[str, str] = {
    "uhc":      "higher_is_better",
    "tb":       "lower_is_better",
    "mal":      "lower_is_better",
    "mmr":      "lower_is_better",
    "u5mr":     "lower_is_better",
    "stunt":    "lower_is_better",
    "maln":     "lower_is_better",
    "anaem":    "lower_is_better",
    "contra":   "higher_is_better",
    "abr":      "lower_is_better",
    "ihr":      "higher_is_better",
    "food":     "lower_is_better",
    "susag":    "higher_is_better",
    "agoda":    "higher_is_better",
    "water":    "higher_is_better",
    "sanit":    "higher_is_better",
    "washmort": "lower_is_better",
    "elec":     "higher_is_better",
    "clean":    "higher_is_better",
    "renew":    "higher_is_better",
    "finc":     "higher_is_better",
    "gii":      "lower_is_better",
    "ndgain":   "lower_is_better",
    "state":    "higher_is_better",
    "pov":      "lower_is_better",
    "mpi":      "lower_is_better",
    "popdens":  "lower_is_better",
    "conces":   "lower_is_better",
}

_PILLAR_KEYS = ["health", "ag", "si", "women", "climate", "ctx", "pri"]




@dataclass(frozen=True)
class PublishInputs:
    """Everything `publish()` needs to read from disk before assembling JSON."""

    yaml_cfg: dict
    country_codes: pd.DataFrame
    pillar_scores: pd.DataFrame
    subdomain_scores: pd.DataFrame
    indicator_scores: pd.DataFrame
    years: list[int]
    pipeline_run_id: str


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------


def load_inputs(
    repo_root: Path,
    pipeline_run_id: str,
    years: Optional[list[int]] = None,

) -> PublishInputs:
    
    yaml_indicators = repo_root / "indicators" / "indicators.yaml"
    data = yaml.safe_load(yaml_indicators.read_text(encoding="utf-8"))
    df_country_codes = pd.read_csv(repo_root / "indicators" / "country_codes.csv")
    df_pillar_scores = pd.read_csv(repo_root / "data" / "interim" / "validated" / "pillarscores.csv")
    df_subdomain_scores = pd.read_csv(repo_root / "data" / "interim" / "validated" / "subdomainscores.csv")
    df_indicator_scores = pd.read_csv(repo_root / "data" / "interim" / "validated" / "Indicator_Scores_Full.csv")

    years = [int(y) for y in (years or sorted(df_pillar_scores["year"].unique()))]
    return PublishInputs(
        yaml_cfg=data,
        country_codes=df_country_codes,
        pillar_scores=df_pillar_scores,
        subdomain_scores=df_subdomain_scores,
        indicator_scores=df_indicator_scores,
        years=years,
        pipeline_run_id=pipeline_run_id,
    )


# ---------------------------------------------------------------------------
# Builders -- one per published file. Pure functions, easy to test.
# ---------------------------------------------------------------------------


def build_meta(inputs: PublishInputs) -> MetaPayload:
    pillars = []
    subdomains = []
    indicators = []

    for pillar in inputs.yaml_cfg.get("pillars", []):
        pkey = pillar["key"]
        plabel = pillar["label"]
        pcolor = _PILLAR_DISPLAY[pkey]["color"]
        prep = _PILLAR_DISPLAY[pkey]["repIndicator"]
        pillars.append({
            "key": pkey,
            "label": plabel,
            "color": pcolor,
            "repIndicator": prep,
        })

        for subdomain in pillar.get("subdomains", []):
            skey = subdomain["key"]
            slabel = subdomain["label"]
            spillar = pkey
            subdomains.append({
                "key": skey,
                "label": slabel,
                "pillar": spillar,
            })

            for indicator in subdomain.get("indicators", []):
                ikey = indicator["frontend_key"]
                ilabel = indicator["name"]
                isdg = ""
                if indicator["id"] is not None and indicator["id"].startswith("SDG"):
                    isdg = "SDG " + indicator["id"]
                else:
                    isdg = indicator["id"]
                
                isource = indicator["data_source"]
                iunit = indicator["unit_or_measure"]
                ipillar = pkey
                isubdomain = skey
                irawDir = _RAW_DIRECTIONS.get(ikey, "lower_is_better")
                iscoredDir = SCORING_DIRECTION

                indicators.append({
                    "key": ikey,
                    "label": ilabel,
                    "sdg": isdg,
                    "source": isource,
                    "unit": iunit,
                    "pillar": ipillar,
                    "subdomain": isubdomain,
                    "rawDirection": irawDir,
                    "scoredDirection": iscoredDir,
                })

    return {
        "schemaVersion": CONTRACT_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "pipelineRunId": inputs.pipeline_run_id,
        "scoringDirection": SCORING_DIRECTION,
        "years": inputs.years,
        "projections": {
            "enabled": False,
            "firstProjectedYear": None,
            "note": "Projection band coming soon.",
        },
        "regions": _REGIONS,
        "pillars": pillars,
        "subdomains": subdomains,
        "indicators": indicators,
    }


def build_countries(inputs: PublishInputs) -> CountriesPayload:
    # assumes country_code in pillarscores.csv is the ISO3

    countries = []
    wide = (
        inputs.pillar_scores.pivot_table(
            index = ["country_code", "year"],
            columns = "pillar_key",
            values = "pillar_score",
            aggfunc = "first",
        )
        .reset_index()
    ) 

    for pk in _PILLAR_KEYS:
        if pk not in wide.columns:
            wide[pk] = float("nan")

    for pk in _PILLAR_KEYS:
        wide[pk] = wide[pk].apply(lambda x: round(100.0 - x, 1) if pd.notna(x) else float("nan"))

    
    # Calculate overall mean of the 7 pillars, but only if all 7 pillars are present (non-null) for that country-year; otherwise overall is null.
    # def _overall(row):
    #   vals = [row[pk] for pk in _PILLAR_KEYS]
    #   if any(pd.isna(v) for v in vals):
    #       return float("nan")
    #   else:
    #       return round(float(sum(vals)) / len(vals), 1)

      
    # Pillars with no data at all are excluded from the null-check so they don't
    # blank out overall for every country. This set shrinks automatically as more
    # pillar data lands (e.g. when women/climate/ctx/pri are wired up).
    _GAPPED_PILLARS = {pk for pk in _PILLAR_KEYS if wide[pk].isna().all()}

    def _overall(row):
        if any(pd.isna(row[pk]) for pk in _PILLAR_KEYS if pk not in _GAPPED_PILLARS):
            return float("nan")
        available = [row[pk] for pk in _PILLAR_KEYS if pd.notna(row[pk])]
        return round(sum(available) / len(available), 1) if available else float("nan")

      
    
    wide["overall"] = wide.apply(_overall, axis=1)

    codes = inputs.country_codes.copy()
    codes["id"] = codes["iso_numeric"].astype(int)
    codes_lookup = codes.set_index("iso3")

    for iso3, group in wide.groupby("country_code"):
        # Skip countries not in country_codes.csv
        if iso3 not in codes_lookup.index:
            continue
        
        meta = codes_lookup.loc[iso3]
        group = group.sort_values("year")
        latest = group.iloc[-1]

        snapshot = {
            pk: (None if pd.isna(latest[pk]) else float(latest[pk])) for pk in _PILLAR_KEYS
        }

        overall = None if pd.isna(latest["overall"]) else float(latest["overall"])

        year_to_overall = {
            int(row["year"]): (None if pd.isna(row["overall"]) else float(row["overall"]))
            for _, row in group.iterrows()
        }
        trend = [year_to_overall.get(y) for y in inputs.years]
    

        countries.append({
            "id": int(meta["id"]),
            "iso3": str(iso3),
            "name": str(meta["name"]),
            "region": str(meta["wb_region_code"]),
            "scores": snapshot,
            "overall": overall,
            "trend": trend,
        }) 

    return sorted(countries, key=lambda x: x["name"])


def _prefer_aggregate_value(g: pd.DataFrame, col: str, aggregate_val: str) -> pd.DataFrame:
    if col not in g.columns:
        return g
    non_null = g[col].dropna()
    if aggregate_val in non_null.values:
        return g[g[col] == aggregate_val]
    return g

# SDG aggregate disaggregation rules
def _filter_for_composites(df: pd.DataFrame) -> pd.DataFrame:
    """
    Restrict to appropriate rows for composite calculation.

    Rule:
    - For each country/year/indicator, if aggregate codes (BOTHSEX, ALLAREA,
      _T, etc.) exist, use only those.
    - If an indicator is only reported for a single category (e.g. FEMALE
      only for SH_STA_MORT), keep that category; do not drop it just because
      BOTHSEX/ALLAREA are absent.
    """
    groups = []
    for _, g in df.groupby(
        ["country_code", "country_name", "year", "series_code"],
        dropna=False,
    ):
        # Prefer BOTHSEX when present; otherwise keep MALE/FEMALE/etc.
        g = _prefer_aggregate_value(g, "sex", "BOTHSEX")
        # Prefer ALLAREA when present; otherwise keep URBAN/RURAL/etc.
        g = _prefer_aggregate_value(g, "location", "ALLAREA")
        # Prefer _T for quantile and education_level when present.
        g = _prefer_aggregate_value(g, "quantile", "_T")
        g = _prefer_aggregate_value(g, "education_level", "_T")
        # Age: if ALLAGE exists for this indicator, prefer it; otherwise keep
        # the age bands that are present (e.g., <5Y for child indicators).
        age_values = g["age"].dropna().unique()
        if "ALLAGE" in age_values:
            g = g[g["age"] == "ALLAGE"]
        groups.append(g)

    if not groups:
        return df.iloc[0:0]

    return pd.concat(groups, axis=0)


def build_timeseries(inputs: PublishInputs) -> TimeseriesPayload:
    from src.calculating.pillar_taxonomy import load_taxonomy
    taxonomy = load_taxonomy()
    series_to_key = {t.series_code: t.frontend_key for t in taxonomy if t.series_code}

    all_indicator_keys = [t.frontend_key for t in taxonomy]

    df = _filter_for_composites(inputs.indicator_scores).copy()
    df["pub_score"] = df["score"].apply(
        lambda x: round(100.0 - x, 1) if pd.notna(x) else float("nan")
    )

    df["frontend_key"] = df["series_code"].map(series_to_key)
    df = df.dropna(subset=["frontend_key"])
    lookup = (
        df.groupby(["country_code", "frontend_key", "year"])["pub_score"]
        .first()
    )


    valid_iso3s = (
        set(inputs.pillar_scores["country_code"].unique())
        & set(inputs.country_codes["iso3"].unique())
    )

    result: TimeseriesPayload = {}
    for iso3 in sorted(valid_iso3s):
        result[iso3] = {}
        for fkey in all_indicator_keys:
            arr = []
            for yr in inputs.years:
                try:
                    val = lookup.loc[(iso3, fkey, yr)]
                    arr.append(None if pd.isna(val) else float(val))
                except KeyError:
                    arr.append(None)
            result[iso3][fkey] = arr
    
    return result


# ---------------------------------------------------------------------------
# Validation -- enforce the data contract before upload.
# ---------------------------------------------------------------------------


def validate_payload(
    meta: MetaPayload,
    countries: CountriesPayload,
    timeseries: TimeseriesPayload,
) -> None:
    
    expected_indicators = {ind["key"] for ind in meta["indicators"]}
    num_years = len(meta["years"])

    # Check meta has 8 regions, 7 pillars, 17 subdomains, 28 indicators
    for field, expected in [("regions", 8), ("pillars", 7), ("subdomains", 17), ("indicators", 28)]:
        if len(meta[field]) != expected:
            raise ValueError(f"meta.{field}: expected {expected}, got {len(meta[field])}")

    # Check every country.region is in meta.regions[].code
    valid_regions = {r["code"] for r in meta["regions"]}

    for c in countries:
        if c["region"] not in valid_regions:
            raise ValueError(f"countries[{c['iso3']}].region = {c['region']!r} not in meta.regions")

    # Check set(timeseries.keys()) == set(c["iso3"] for c in countries)
    ts_iso3s = set(timeseries.keys())
    c_iso3s = {c["iso3"] for c in countries}
    if ts_iso3s != c_iso3s:
        missing_in_ts = c_iso3s - ts_iso3s
        extra_in_ts = ts_iso3s - c_iso3s
        raise ValueError(
            f"timeseries ISO3 keys do not match countries: "
            f"missing in timeseries: {missing_in_ts}, extra in timeseries: {extra_in_ts}"
        )
        
    # Check for every iso3 in timeseries: keys() == set(meta.indicators[*].key)
    for iso3, indicators_dict in timeseries.items():
        actual = set(indicators_dict.keys())

        if actual != expected_indicators:
            missing_indicators = expected_indicators - actual
            extra_indicators = actual - expected_indicators
            raise ValueError(
                f"timeseries[{iso3}] indicators keys do not match meta.indicators: "
                f"missing: {missing_indicators}, extra: {extra_indicators}"
            )
        for ind_key, arr in indicators_dict.items():
            if len(arr) != num_years:
                raise ValueError(
                    f"timeseries[{iso3}][{ind_key}] length={len(arr)}, expected {num_years}"
                )
    
    # Check all non-null numeric scores are in [0, 100]
    for c in countries:
        iso3 = c["iso3"]
        for pillar, val in c["scores"].items():
            if val is not None and not (0.0 <= val <= 100.0):
                raise ValueError(f"countries[{iso3}].scores[{pillar}] = {val} out of range [0, 100]")
    
        if c["overall"] is not None and not (0.0 <= c["overall"] <= 100.0):
            raise ValueError(f"countries[{iso3}].overall = {c['overall']} out of range [0, 100]")
        
        for i, v in enumerate(c["trend"]):
            if v is not None and not (0.0 <= v <= 100.0):
                raise ValueError(f"countries[{iso3}].trend[{i}] = {v} out of range [0, 100]")
   
    for iso3, indicators_dict in timeseries.items():
        for fkey, arr in indicators_dict.items():
            for i, v in enumerate(arr):
                if v is not None and not (0.0 <= v <= 100.0):
                    raise ValueError(f"timeseries[{iso3}][{fkey}][{i}] = {v} out of range [0, 100]")


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------


def publish(
    repo_root: Path,
    pipeline_run_id: str,
    target_container: str = DASHBOARD_CONTAINER_DEFAULT,
    prefix: str = PUBLISH_PREFIX_DEFAULT,
    *,
    dry_run: bool = False,
) -> None:
    
    load_dotenv()
    inputs = load_inputs(repo_root, pipeline_run_id)
    meta = build_meta(inputs)
    countries = build_countries(inputs)
    timeseries = build_timeseries(inputs)
    validate_payload(meta, countries, timeseries)

    payloads = [
        ("meta.json", meta),
        ("countries.json", countries),
        ("timeseries.json", timeseries),
    ]

    if dry_run:
        output_dir = repo_root / "data" / "organized" / prefix
        output_dir.mkdir(parents=True, exist_ok=True)
        for name, payload in payloads:
            (output_dir / name).write_text(
                json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        print(f"Dry run complete. Files written to {output_dir}")
        return

    # Azure upload — validate credentials before attempting any upload.
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    account_url = os.getenv("AZURE_STORAGE_ACCOUNT_URL")
    missing = [k for k, v in {
        "AZURE_TENANT_ID": tenant_id,
        "AZURE_CLIENT_ID": client_id,
        "AZURE_CLIENT_SECRET": client_secret,
        "AZURE_STORAGE_ACCOUNT_URL": account_url,
    }.items() if not v]
    if missing:
        raise EnvironmentError(f"Missing required env vars: {', '.join(missing)}")

    credential = ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret,
    )
    container = BlobServiceClient(
        account_url=account_url,
        credential=credential,
    ).get_container_client(target_container)

    blob_settings = ContentSettings(
        content_type="application/json; charset=utf-8",
        cache_control="public, max-age=3600",
    )

    # Upload the three payload files first, then write manifest.json last.
    # A reader that checks for manifest.json will never see a partial publish.
    for name, payload in payloads:
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        container.get_blob_client(prefix + name).upload_blob(
            data, overwrite=True, content_settings=blob_settings,
        )
        print(f"Uploaded {prefix + name} ({len(data):,} bytes)")

    manifest = {
        "schemaVersion": CONTRACT_VERSION,
        "publishedAt": datetime.now(timezone.utc).isoformat(),
        "pipelineRunId": pipeline_run_id,
        "files": [prefix + name for name, _ in payloads],
    }
    manifest_data = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
    container.get_blob_client(prefix + "manifest.json").upload_blob(
        manifest_data,
        overwrite=True,
        content_settings=ContentSettings(
            content_type="application/json; charset=utf-8",
            cache_control="no-cache",
        ),
    )
    print(f"Uploaded {prefix}manifest.json — publish complete")


if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

    from src.pipeline.utils import project_root

    # Usage:
    #   python -m src.upload.publish_dashboard            # dry run (default)
    #   python -m src.upload.publish_dashboard --azure    # upload to Azure Blob
    azure = "--azure" in sys.argv
    run_id = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--run-id" and i + 1 < len(sys.argv)), "manual-run")

    publish(
        repo_root=project_root(),
        pipeline_run_id=run_id,
        dry_run=not azure,
    )
