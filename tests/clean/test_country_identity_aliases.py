from __future__ import annotations

import pandas as pd
import pytest

from src.utils.country_identity import _LEGACY_ISO3, resolve


def test_legacy_ado_resolves_to_and():
    assert resolve("ADO") == "AND"
    assert resolve(" ado ") == "AND"


@pytest.mark.parametrize("legacy,target", sorted(_LEGACY_ISO3.items()))
def test_every_legacy_target_is_canonical(legacy, target):
    from src.pipeline.utils import project_root

    cc = pd.read_csv(project_root() / "indicators" / "country_codes.csv")
    assert target in set(cc["iso3"])
    assert resolve(legacy) == target


@pytest.mark.parametrize("code", ["AND", "KEN", "USA"])
def test_valid_iso3_unchanged(code):
    assert resolve(code) == code


@pytest.mark.parametrize("code", ["ANT", "AIA", "COK", "GUF", "JEY", "MTQ", "NIU", "REU", "TWN"])
def test_out_of_scope_code_unchanged(code):
    assert resolve(code) == code
