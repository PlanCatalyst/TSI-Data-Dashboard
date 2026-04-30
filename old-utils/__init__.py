"""
Shared project-wide utilities.

Modules:
  helpers        — project_root(), setup_logger(), ensure_dir()
  country_names  — canonical country display names and continent/region mapping

Note: UN SDG collision-duplicate detection lives at src/clean/collision_check.py
(it is clean-time logic, not a general utility).
"""

from src.utils.helpers import project_root, setup_logger, ensure_dir
from src.utils.country_names import (
    COUNTRY_NAMES,
    COUNTRY_REGIONS,
    REGION_NAMES,
    get_canonical_name,
    get_region,
    get_region_name,
)

__all__ = [
    "project_root",
    "setup_logger",
    "ensure_dir",
    "COUNTRY_NAMES",
    "COUNTRY_REGIONS",
    "REGION_NAMES",
    "get_canonical_name",
    "get_region",
    "get_region_name",
]
