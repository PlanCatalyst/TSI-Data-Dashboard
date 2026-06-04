"""
Pillar / subdomain taxonomy loaded from `indicators/indicators.yaml`.

Bridges two naming worlds:

1. The yaml / frontend world, which names things with `frontend_key` (e.g.
   "uhc", "tb") inside a 7-pillar taxonomy
   (`health, ag, si, women, climate, ctx, pri`).

2. The pipeline world, which uses source-specific `series_code` values
   (e.g. "SH_ACS_UNHC_25", "EN.POP.DNST") as primary keys on the scored
   DataFrames.

This module exposes lookup tables so `pillar_aggregate.py` can roll indicator
scores up to subdomain and pillar without caring which naming world it started
in.

The SDG indicators are bridged automatically through `SDG_ID_TO_SERIES_CODE`.
Non-SDG indicators (GII, ND-GAIN composite, MPI, State Capacity, HDI,
population density) have no SDG id and must be bridged through the explicit
`NON_SDG_FRONTEND_KEY_TO_SERIES_CODE` map below. See
[indicators/SCORING_AUDIT.md](../../indicators/SCORING_AUDIT.md) for which of
these are currently wired in the pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
YAML_PATH = REPO_ROOT / "indicators" / "indicators.yaml"


# Non-SDG indicators -> series_code expected by the pipeline.
# When the pipeline team wires up a new data source, the series_code it uses
# should appear here (or the pipeline should be updated to emit the listed
# code) so pillar aggregation picks it up automatically.
NON_SDG_FRONTEND_KEY_TO_SERIES_CODE: Dict[str, Optional[str]] = {
    "gii": "GII_INDEX",
    "ndgain": "ND_GAIN_VULN",
    "mpi": "MPI_INDEX",
    "popdens": "EN.POP.DNST",
    "state": "WGI_GOVEFF",
    # `pri` pillar proxy: HDI replaces the unbuildable Concessionality Index
    # (no global dataset). Sourced from UNDP HDR (same file as `gii`).
    "hdi": "HDI_INDEX",
}

SDG_ID_TO_SERIES_CODE: Dict[str, str] = {
    "1.2.1": "SI_POV_NAHC",
    "2.1.2": "AG_PRD_FIESMS",
    "2.2.1": "SH_STA_STNT",
    "2.2.2": "SN_STA_OVWGT",
    "2.2.3": "SH_STA_ANEM",
    "2.4.1": "AG_LND_SUST",
    "2.a.2": "DC_TOF_AGRL",
    "3.1.1": "SH_STA_MORT",
    "3.2.1": "SH_DYN_MORT",
    "3.3.2": "SH_TBS_INCD",
    "3.3.3": "SH_STA_MALR",
    "3.7.1": "SH_FPL_MTMM",
    "3.7.2": "SP_DYN_ADKL",
    "3.8.1": "SH_ACS_UNHC_25",
    "3.9.2": "SH_STA_WASHARI",
    "3.d.1": "SH_IHR_CAPS",
    "6.1.1": "SH_H2O_SAFE",
    "6.2.1": "SH_SAN_SAFE",
    "7.1.1": "EG_ACS_ELEC",
    "7.1.2": "EG_EGY_CLEAN",
    "7.2.1": "EG_FEC_RNEW",
    "8.10.2": "FB_BNK_ACCSS",
}


@dataclass(frozen=True)
class IndicatorTaxonomy:
    frontend_key: str
    pillar_key: str
    subdomain_key: str
    sdg_id: Optional[str]
    series_code: Optional[str]


@dataclass(frozen=True)
class PillarDef:
    key: str
    label: str
    subdomain_keys: List[str]


@lru_cache(maxsize=1)
def _load_yaml() -> dict:
    with YAML_PATH.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


@lru_cache(maxsize=1)
def load_taxonomy() -> List[IndicatorTaxonomy]:
    """Return the flat list of 28 indicator taxonomy records."""
    cfg = _load_yaml()

    records: List[IndicatorTaxonomy] = []
    for pillar in cfg.get("pillars", []):
        pillar_key = pillar["key"]
        for sub in pillar.get("subdomains", []):
            subdomain_key = sub["key"]
            for ind in sub.get("indicators", []):
                fk = ind["frontend_key"]
                sdg_id = ind.get("id")
                if sdg_id:
                    series_code = SDG_ID_TO_SERIES_CODE.get(sdg_id)
                else:
                    series_code = NON_SDG_FRONTEND_KEY_TO_SERIES_CODE.get(fk)
                records.append(
                    IndicatorTaxonomy(
                        frontend_key=fk,
                        pillar_key=pillar_key,
                        subdomain_key=subdomain_key,
                        sdg_id=sdg_id,
                        series_code=series_code,
                    )
                )
    return records


@lru_cache(maxsize=1)
def load_pillars() -> List[PillarDef]:
    cfg = _load_yaml()
    pillars: List[PillarDef] = []
    for p in cfg.get("pillars", []):
        pillars.append(
            PillarDef(
                key=p["key"],
                label=p.get("label", p["key"]),
                subdomain_keys=[s["key"] for s in p.get("subdomains", [])],
            )
        )
    return pillars


@lru_cache(maxsize=1)
def series_code_to_pillar_subdomain() -> Dict[str, tuple[str, str]]:
    """Map series_code -> (pillar_key, subdomain_key) for lookup during aggregation."""
    out: Dict[str, tuple[str, str]] = {}
    for t in load_taxonomy():
        if t.series_code:
            out[t.series_code] = (t.pillar_key, t.subdomain_key)
    return out


@lru_cache(maxsize=1)
def subdomain_to_pillar() -> Dict[str, str]:
    out: Dict[str, str] = {}
    for p in load_pillars():
        for sk in p.subdomain_keys:
            out[sk] = p.key
    return out


def list_pillar_keys() -> List[str]:
    return [p.key for p in load_pillars()]


@lru_cache(maxsize=1)
def series_code_to_filename() -> Dict[str, str]:
    """Map series_code to per-indicator output CSV filename."""
    out: Dict[str, str] = {}
    for t in load_taxonomy():
        if t.series_code:
            out[t.series_code] = f"{t.frontend_key}.csv"
    if "EN.POP.DNST" in out and "POP_DENSITY" not in out:
        out["POP_DENSITY"] = out["EN.POP.DNST"]
    return out
