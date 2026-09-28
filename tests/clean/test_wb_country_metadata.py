"""Country reference table used to resolve IDS scope for the mspi index.

Scope rule source: client spec revision 2026-09-23, docs/spec-macrosec-index.md.
"""

import pandas as pd

from src.clean.world_bank_clean import WorldBankCleaner


def _record(iso3, name, lending, income="LIC", region="SSF"):
    return {
        "id": iso3,
        "name": name,
        "region": {"id": region, "value": region},
        "incomeLevel": {"id": income, "value": income},
        "lendingType": {"id": lending, "value": lending},
    }


def _cleaner():
    return WorldBankCleaner(config={})


def test_borrower_lending_types_are_in_scope():
    records = [
        _record("AFG", "Afghanistan", "IDX"),
        _record("AGO", "Angola", "IBD"),
        _record("BGD", "Bangladesh", "IDB"),
    ]
    df = _cleaner().clean_country_metadata(records)
    assert df["ids_in_scope"].all()


def test_not_classified_is_out_of_scope():
    df = _cleaner().clean_country_metadata(
        [_record("ABW", "Aruba", "LNX", income="HIC")]
    )
    assert not df.loc[0, "ids_in_scope"]


def test_high_income_ida_borrower_stays_in_scope():
    """Guyana is IDX and high income. Scope keys on lending type, never income."""
    df = _cleaner().clean_country_metadata(
        [_record("GUY", "Guyana", "IDX", income="HIC")]
    )
    assert df.loc[0, "ids_in_scope"]
    assert df.loc[0, "income_level"] == "HIC"


def test_aggregates_are_dropped():
    """World Bank marks regions and income groups with region.id == 'NA'."""
    records = [
        _record("AFG", "Afghanistan", "IDX"),
        _record("ARB", "Arab World", "", region="NA"),
        _record("LIC", "Low income", "", region="NA"),
    ]
    df = _cleaner().clean_country_metadata(records)
    assert list(df["country_code"]) == ["AFG"]


def test_missing_lending_type_is_null_and_out_of_scope():
    records = [{"id": "XXX", "name": "Nowhere", "region": {"id": "SSF"}}]
    df = _cleaner().clean_country_metadata(records)
    assert pd.isna(df.loc[0, "lending_type"])
    assert not df.loc[0, "ids_in_scope"]


def test_empty_input_returns_typed_empty_frame():
    df = _cleaner().clean_country_metadata([])
    assert df.empty
    assert list(df.columns) == [
        "country_code",
        "country_name",
        "lending_type",
        "income_level",
        "region",
        "ids_in_scope",
    ]


def test_duplicate_iso3_keeps_one_row():
    records = [
        _record("AFG", "Afghanistan", "IDX"),
        _record("AFG", "Afghanistan", "IBD"),
    ]
    df = _cleaner().clean_country_metadata(records)
    assert len(df) == 1
    assert df.loc[0, "lending_type"] == "IBD"
