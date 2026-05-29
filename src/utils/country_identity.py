"""
Canonical country-identity resolution.

Single source of truth for turning a raw country reference (ISO3 string,
UN M49 numeric code, or a human-readable country name in any of the common
HDR/UN long-form variants) into an ISO 3166-1 alpha-3 code.

Why this module exists
----------------------
Before this module, three different cleaners each carried their own
identity-resolution dicts:

  * ``un_sdg_clean._UN_SDG_COUNTRY_CODES``  — M49 numeric → ISO3 (~250 entries)
  * ``undp_hdr_clean._HDR_NAME_TO_ISO3``    — UN long-form name → ISO3 (~40 entries)
  * various passthroughs in ``nd_gain_clean``, ``wb_wgi_clean``, ``world_bank_clean``

Adding a new source's naming convention meant adding a 4th dict. This module
collapses them into one resolver. Future sources call :func:`resolve` instead
of carrying their own dict.

Public surface
--------------
* :func:`resolve` — accept ISO3 / M49 / name in any form, return ISO3 or None.
* :func:`m49_to_iso3` — narrow helper kept for the UN SDG cleaner's hot path.
* :func:`name_to_iso3` — narrow helper kept for the UNDP HDR cleaner.
* :func:`normalize_name` — lowercase + strip diacritics + collapse whitespace.

Sources of truth (in priority order)
------------------------------------
1. ``indicators/country_codes.csv``  — the 216-row canonical list. Provides
   ISO3 ↔ M49 ↔ canonical display name. Single source of truth.
2. :data:`_EXTRA_M49`  — UN M49 codes for territories and dependencies that
   the canonical list intentionally omits (Antarctica, Bouvet Island, BIOT,
   Christmas Island, Cocos Is, Cook Islands, Falklands, ...). UN SDG data
   rarely references these but the un_sdg cleaner historically tolerated them.
3. :data:`_NAME_ALIASES`  — HDR/UN long-form name variants ("Bolivia
   (Plurinational State of)", "Türkiye", ...) that the canonical list's
   short-form names do not match. Manually curated; add an alias when a new
   source surfaces a name that fails to resolve.

This is a behaviour-preserving consolidation. As of 2026-05-24 the cross-
checks pass: every M49 code in both ``_EXTRA_M49`` and the canonical list
agrees on its ISO3, and every alias key in ``_NAME_ALIASES`` agrees with the
canonical list on the rare cases where they overlap.
"""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import pandas as pd


# ---------------------------------------------------------------------------
# UN M49 extras: codes the canonical country_codes.csv intentionally omits
# (territories / dependencies). UN SDG data rarely references these but the
# historical un_sdg_clean cleaner tolerated them, so we preserve that.
# ---------------------------------------------------------------------------
_EXTRA_M49: dict[str, str] = {
    "010": "ATA",  # Antarctica
    "074": "BVT",  # Bouvet Island
    "086": "IOT",  # British Indian Ocean Territory
    "162": "CXR",  # Christmas Island
    "166": "CCK",  # Cocos (Keeling) Islands
    "184": "COK",  # Cook Islands
    "238": "FLK",  # Falkland Islands
    "254": "GUF",  # French Guiana
    "312": "GLP",  # Guadeloupe
    "660": "AIA",  # Anguilla
    "831": "GGY",  # Guernsey
    "832": "JEY",  # Jersey
    "239": "SGS",  # South Georgia & the South Sandwich Islands
    "248": "ALA",  # Aland Islands
    "260": "ATF",  # French Southern Territories
    "334": "HMD",  # Heard Island & McDonald Islands
    "336": "VAT",  # Holy See
    "474": "MTQ",  # Martinique
    "175": "MYT",  # Mayotte
    "500": "MSR",  # Montserrat
    "534": "SXM",  # Sint Maarten (Dutch part)
    "535": "BES",  # Bonaire, Sint Eustatius and Saba
    "531": "CUW",  # Curacao
    "540": "NCL",  # New Caledonia
    "570": "NIU",  # Niue
    "574": "NFK",  # Norfolk Island
    "580": "MNP",  # Northern Mariana Islands
    "581": "UMI",  # US Minor Outlying Islands
    "612": "PCN",  # Pitcairn
    "638": "REU",  # Reunion
    "652": "BLM",  # St. Barthelemy
    "654": "SHN",  # St. Helena
    "663": "MAF",  # St. Martin (French part)
    "666": "SPM",  # St. Pierre & Miquelon
    "732": "ESH",  # Western Sahara
    "744": "SJM",  # Svalbard and Jan Mayen
    "772": "TKL",  # Tokelau
    "876": "WLF",  # Wallis and Futuna
}


# ---------------------------------------------------------------------------
# Name aliases: UN/HDR long-form variants that don't match country_codes.csv's
# short canonical names verbatim. Keys MUST be normalized via normalize_name.
# Add an alias when a new source ships a name that fails to resolve; do not
# invent aliases speculatively.
# ---------------------------------------------------------------------------
_NAME_ALIASES: dict[str, str] = {
    "bolivia (plurinational state of)": "BOL",
    "iran (islamic republic of)": "IRN",
    "korea (republic of)": "KOR",
    "korea (democratic people's republic of)": "PRK",
    "tanzania (united republic of)": "TZA",
    "venezuela (bolivarian republic of)": "VEN",
    "lao people's democratic republic": "LAO",
    "moldova (republic of)": "MDA",
    "viet nam": "VNM",
    "cote d'ivoire": "CIV",
    "côte d'ivoire": "CIV",
    "eswatini (kingdom of)": "SWZ",
    "eswatini": "SWZ",
    "türkiye": "TUR",
    "turkiye": "TUR",
    "state of palestine": "PSE",
    "palestine, state of": "PSE",
    "palestine": "PSE",
    "north macedonia": "MKD",
    "congo": "COG",
    "congo (democratic republic of the)": "COD",
    "democratic republic of the congo": "COD",
    "saint lucia": "LCA",
    "saint vincent and the grenadines": "VCT",
    "gambia (the)": "GMB",
    "bahamas (the)": "BHS",
    "russian federation": "RUS",
    "syrian arab republic": "SYR",
    "yemen (republic of)": "YEM",
    "hong kong, china (sar)": "HKG",
    "united kingdom": "GBR",
    "united states": "USA",
    "czechia": "CZE",
    "czech republic": "CZE",
    "cabo verde": "CPV",
    "cape verde": "CPV",
    "myanmar": "MMR",
    "timor-leste": "TLS",
    "sao tome and principe": "STP",
    "são tomé and príncipe": "STP",
    "micronesia (federated states of)": "FSM",
    "bosnia and herzegovina": "BIH",
    "trinidad and tobago": "TTO",
}


_ISO3_RE = re.compile(r"^[A-Z]{3}$")


def normalize_name(name: Any) -> str:
    """Lowercase, strip diacritics, normalize curly quotes, collapse whitespace.

    Returns an empty string for non-string or empty input so callers can use
    the result directly as a dict key without further checks.
    """
    if not isinstance(name, str):
        return ""
    s = unicodedata.normalize("NFKD", name)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("’", "'").replace("‘", "'").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


@lru_cache(maxsize=1)
def _canonical_m49_to_iso3() -> dict[str, str]:
    """Load M49 → ISO3 from country_codes.csv, layered with _EXTRA_M49.

    Canonical wins on collisions, but the cross-check at module-doc time
    confirmed there are no collisions today.
    """
    from src.pipeline.utils import project_root

    cc_path = project_root() / "indicators" / "country_codes.csv"
    mapping: dict[str, str] = dict(_EXTRA_M49)
    if cc_path.exists():
        cc = pd.read_csv(cc_path)
        for _, row in cc.iterrows():
            try:
                m49 = str(int(row["iso_numeric"])).zfill(3)
            except (TypeError, ValueError):
                continue
            mapping[m49] = str(row["iso3"])
    return mapping


@lru_cache(maxsize=1)
def _canonical_name_to_iso3() -> dict[str, str]:
    """Load normalized canonical names from country_codes.csv, layered with
    _NAME_ALIASES. Canonical-first; aliases fill gaps."""
    from src.pipeline.utils import project_root

    cc_path = project_root() / "indicators" / "country_codes.csv"
    mapping: dict[str, str] = {}
    if cc_path.exists():
        cc = pd.read_csv(cc_path)
        for _, row in cc.iterrows():
            n = normalize_name(row.get("name"))
            if n:
                mapping.setdefault(n, str(row["iso3"]))
    for alias, iso3 in _NAME_ALIASES.items():
        mapping.setdefault(alias, iso3)
    return mapping


def m49_to_iso3(code: Any) -> Optional[str]:
    """Resolve a UN M49 numeric code (int, float, or zero-padded string) to ISO3.

    Returns None for unrecognized or malformed input.
    """
    if code is None:
        return None
    if isinstance(code, float) and pd.isna(code):
        return None
    try:
        n = int(float(str(code).strip()))
    except (TypeError, ValueError):
        return None
    key = str(n).zfill(3)
    return _canonical_m49_to_iso3().get(key)


def name_to_iso3(name: Any) -> Optional[str]:
    """Resolve a country display name to ISO3, normalizing case/diacritics.

    Returns None for unrecognized names. Add new aliases to _NAME_ALIASES.
    """
    n = normalize_name(name)
    if not n:
        return None
    return _canonical_name_to_iso3().get(n)


def resolve(raw: Any) -> Optional[str]:
    """Resolve a raw country reference to ISO3.

    Accepts ISO3 strings (passthrough after shape check), UN M49 codes,
    or any human-readable name we have an alias for. Returns ISO3 or None.

    This is the entry point new cleaners should call.
    """
    if raw is None:
        return None
    if isinstance(raw, float) and pd.isna(raw):
        return None
    if isinstance(raw, str):
        upper = raw.strip().upper()
        if _ISO3_RE.match(upper):
            return upper
    # Try M49 numeric (works for "4", "004", 4, 4.0).
    iso3 = m49_to_iso3(raw)
    if iso3 is not None:
        return iso3
    # Fall back to name resolution.
    return name_to_iso3(raw)
