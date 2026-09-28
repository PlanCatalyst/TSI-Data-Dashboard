from src.fetch.world_bank_fetch import _year_in_range, sdmx_obs_to_record


def test_sdmx_obs_to_record_maps_debtor_year_and_value():
    rec = sdmx_obs_to_record(
        {
            "variable": [
                {"concept": "Country", "id": "KEN", "value": "Kenya"},
                {"concept": "Counterpart-Area", "id": "WLD", "value": "World"},
                {
                    "concept": "Series",
                    "id": "DT.DOD.ALLC.ZS",
                    "value": "Concessional debt (% of total external debt)",
                },
                {"concept": "Time", "id": "YR2020", "value": "2020"},
            ],
            "value": 42.5,
        }
    )
    assert rec["countryiso3code"] == "KEN"
    assert rec["country"]["value"] == "Kenya"
    assert rec["indicator"]["id"] == "DT.DOD.ALLC.ZS"
    assert rec["date"] == "2020"
    assert rec["value"] == 42.5


def test_year_in_range_filters_ids_history():
    assert _year_in_range("2010", 2010, 2024)
    assert _year_in_range("2024", 2010, 2024)
    assert not _year_in_range("1970", 2010, 2024)
    assert not _year_in_range("2032", 2010, 2024)
    assert not _year_in_range(None, 2010, 2024)
