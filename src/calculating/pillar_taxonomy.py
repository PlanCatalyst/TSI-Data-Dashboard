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

The SDG indicators are bridged automatically via
`hierarchy.INDICATORS[series_code].indicator_id == yaml.id`. Non-SDG indicators
(GII, ND-GAIN composite, MPI, State Capacity, Concessionality, population
density) have no SDG id and must be bridged through the explicit
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

from .hierarchy import INDICATORS


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
    "state": None,
    "conces": None,
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
def _indicator_id_to_series_code() -> Dict[str, str]:
    return {meta.indicator_id: meta.series_code for meta in INDICATORS.values()}


@lru_cache(maxsize=1)
def load_taxonomy() -> List[IndicatorTaxonomy]:
    """Return the flat list of 28 indicator taxonomy records."""
    cfg = _load_yaml()
    id_map = _indicator_id_to_series_code()

    records: List[IndicatorTaxonomy] = []
    for pillar in cfg.get("pillars", []):
        pillar_key = pillar["key"]
        for sub in pillar.get("subdomains", []):
            subdomain_key = sub["key"]
            for ind in sub.get("indicators", []):
                fk = ind["frontend_key"]
                sdg_id = ind.get("id")
                if sdg_id:
                    series_code = id_map.get(sdg_id)
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
