"""
Publish dashboard JSON to Azure Blob - SKELETON / CONTRACT.

Status: NOT a complete implementation. This module exists as the canonical
target shape for the team's full implementation post-handoff. All function
bodies are `TODO` stubs that document the expected behaviour. The signatures
and the data shapes they construct are the binding contract.

Why a skeleton:
- Pins the [docs/data-contract.md](../../docs/data-contract.md) shapes in code
  so reviewers can diff against typed signatures, not prose.
- Lets the frontend team build against deterministic, locally-generated
  fixtures (call `build_meta()` / `build_countries()` / `build_timeseries()`
  in a test, dump JSON, fetch from disk).
- Makes the publish boundary the place where pipeline-direction
  ("higher = more need") flips to dashboard-direction
  ("higher = more favourable"). See
  [indicators/SCORING_AUDIT.md](../../indicators/SCORING_AUDIT.md).

Run order (when fully implemented):
    1. Pipeline writes to data/interim/validated/ (pillar+subdomain CSVs +
       Indicator_Scores_Full.csv).
    2. `publish()` reads those + `indicators/country_codes.csv` +
       `indicators/indicators.yaml`.
    3. Builds meta/countries/timeseries dicts; validates against the contract;
       uploads to the `dashboard-public` Azure container under `/v1/`.
    4. Existing `/v1/` is overwritten atomically (publish each blob, then swap
       a `manifest.json` last so partial uploads never go live).

Conventions:
- All numeric scores in the published JSON are in [0, 100], higher is better.
- `null` for missing data; never `NaN`, never `0` as sentinel.
- `iso3` is the canonical country join key; `id` (ISO numeric) is included for
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
        yaml_cfg = data,
        country_codes = df_country_codes,
        pillar_scores = df_pillar_scores,
        subdomain_scores = df_subdomain_scores,
        indicator_scores = df_indicator_scores,
        years = years,
        pipeline_run_id = pipeline_run_id,
    )


    # """
    # Read all upstream artifacts needed to publish.

    # Inputs:
    #   indicators/indicators.yaml         -> taxonomy
    #   indicators/country_codes.csv       -> ISO3/numeric/region join table
    #   data/interim/validated/pillarscores.csv
    #   data/interim/validated/subdomainscores.csv
    #   data/interim/validated/Indicator_Scores_Full.csv
    # """


    # raise NotImplementedError(
    #     "TODO: read yaml + country_codes.csv + pipeline-validated CSVs into a PublishInputs"
    # )


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
                if indicator["id"] != "null":
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
            "note": "Projection band coming soon."
        },
        "regions": _REGIONS,
        "pillars": pillars,
        "subdomains": subdomains,
        "indicators": indicators,
    }    

    # """
    # Assemble `meta.json`.

    # Shape (see docs/data-contract.md §2):
    #     {
    #       "schemaVersion":     CONTRACT_VERSION,
    #       "generatedAt":       ISO-8601 UTC,
    #       "pipelineRunId":     str,
    #       "scoringDirection":  "higher_is_better",
    #       "years":             [int, ...]                  # ascending,
    #       "projections":       {"enabled": bool,
    #                             "firstProjectedYear": int|null,
    #                             "note": str},
    #       "regions":           [{"code": str, "label": str}, ...],   # 8
    #       "pillars":           [{"key", "label", "color", "repIndicator"}, ...],   # 7
    #       "subdomains":        [{"key", "label", "pillar"}, ...],    # 17
    #       "indicators":        [{"key", "label", "sdg", "source", "unit",
    #                              "pillar", "subdomain", "rawDirection",
    #                              "scoredDirection"}, ...]            # 28
    #     }
    # """
    # raise NotImplementedError(
    #     "TODO: project yaml + run metadata into the meta.json shape; pillars must "
    #     "include color + repIndicator (lift from data-contract.md §2 example or wire to settings)"
    # )


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
    def _overall(row):
      vals = [row[pk] for pk in _PILLAR_KEYS]
      if any(pd.isna(v) for v in vals):
          return float("nan")
      else:
          return round(float(sum(vals)) / len(vals), 1)
      
    
    wide["overall"] = wide.apply(_overall, axis=1)

    codes = inputs.country_codes.copy()
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

 
    # """
    # Assemble `countries.json`.

    # For each country present in `country_codes.csv` AND in pillar_scores:

    #     {
    #       "id":      int,                 # ISO-3166-1 numeric
    #       "iso3":    str,                 # 3-letter
    #       "name":    str,                 # from country_codes.csv
    #       "region":  str,                 # one of 8 WB codes
    #       "scores":  {"health":float|null, "ag":..., "si":..., "women":...,
    #                   "climate":..., "ctx":..., "pri":...},
    #       "overall": float|null,          # mean of the 7 pillar scores
    #       "trend":   [float|null, ...]    # length == len(years)
    #     }

    # Requirements:
    #   - Use the LATEST year present in pillar_scores for the snapshot scores
    #     (the per-country `scores` block).
    #   - `overall` is null if any pillar score is null.
    #   - `trend[i]` is the country's per-year overall computed from that year's
    #     pillar scores; null if any pillar is null in year i.
    #   - All scores must be inverted from pipeline orientation:
    #         published = round(100 - pipeline_score, 1)
    #     See indicators/SCORING_AUDIT.md.
    #   - Round all numeric outputs to 1 decimal.
    # """
    # raise NotImplementedError(
    #     "TODO: pivot pillar_scores wide on pillar_key, join country_codes, "
    #     "compute overall + trend, invert direction (100-x), round to 1dp"
    # )


def build_timeseries(inputs: PublishInputs) -> TimeseriesPayload:
    """
    Assemble `timeseries.json`.

    Shape:
        {
          "<ISO3>": {
            "<indicator_key>": [val_year_0, val_year_1, ..., val_year_N]
          }
        }

    Requirements:
      - Top-level keys: every iso3 from `countries.json`.
      - Second-level keys: every indicator `key` from `meta.indicators`.
      - Array length == len(years); positions align to `meta.years`.
      - Values are the SCORED indicator value in [0, 100], inverted to dashboard
        direction (100 - pipeline_score). null where missing.
      - For SDG indicators, source is `Indicator_Scores_Full.csv` filtered to
        aggregate disaggregations only (BOTHSEX/ALLAREA/_T/ALLAGE - see
        `aggregate._filter_for_composites` for the exact rule).
      - For non-SDG indicators (gii, ndgain, mpi, state, conces, popdens), use
        whatever the pipeline emits as their series_code; lookup table in
        `src/calculating/pillar_taxonomy.NON_SDG_FRONTEND_KEY_TO_SERIES_CODE`.
    """
    raise NotImplementedError(
        "TODO: long->wide pivot of per-indicator scored values per (iso3, year), "
        "inversion + null-padding to len(years), keyed by frontend_key"
    )


# ---------------------------------------------------------------------------
# Validation -- enforce the data contract before upload.
# ---------------------------------------------------------------------------


def validate_payload(
    meta: MetaPayload,
    countries: CountriesPayload,
    timeseries: TimeseriesPayload,
) -> None:
    """
    Assert every contract invariant from docs/data-contract.md §7.

    Raises a descriptive ValueError on the first failure; aborts the publish.

    Checks:
      1. meta has 8 regions, 7 pillars, 17 subdomains, 28 indicators.
      2. Every country.region is in meta.regions[].code.
      3. set(timeseries.keys()) == set(c["iso3"] for c in countries).
      4. For every iso3 in timeseries: keys() == set(meta.indicators[*].key)
         AND every value array has len == len(meta.years).
      5. All non-null numeric scores are in [0, 100].
    """
    raise NotImplementedError(
        "TODO: implement the 5 invariant checks; raise ValueError with a precise locator on failure"
    )


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
    """
    End-to-end publish:

      1. load_inputs(repo_root, pipeline_run_id)
      2. meta       = build_meta(inputs)
      3. countries  = build_countries(inputs)
      4. timeseries = build_timeseries(inputs)
      5. validate_payload(meta, countries, timeseries)        -- aborts on failure
      6. write to /tmp first, then upload all 3 blobs with:
            Cache-Control: public, max-age=3600
            Content-Type:  application/json; charset=utf-8
      7. If dry_run, write to repo_root/data/organized/v1/ instead of uploading.

    Auth:
      Reuse `UploadValidated`-style ClientSecretCredential pattern from
      `src/upload/upload_validated.py`. Env vars:
        AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
        AZURE_STORAGE_ACCOUNT_URL.

    Container setup (one-time, manual):
      - Create `dashboard-public` container with anonymous BLOB read.
      - Apply CORS rule: AllowedOrigins = [<wix domain>, http://localhost:5173,
        http://localhost:4173]; AllowedMethods=GET; AllowedHeaders=*.

    Note:
      The local pre-publish output target is the organized data layer
      (`data/organized/v1/`) so frontend integration can validate payload shape
      before Azure upload.

    See docs/data-contract.md for the full shape spec; this skeleton is the
    code-level mirror.
    """
    raise NotImplementedError(
        "TODO: orchestrate load -> build -> validate -> write/upload. "
        "When implementing, lift the auth pattern from src/upload/upload_validated.py"
    )


if __name__ == "__main__":
    raise SystemExit(
        "publish_dashboard.py is currently a contract skeleton. "
        "See module docstring and docs/data-contract.md."
    )
