"""Survey-year label parsing for the UNDP HDR (OPHI MPI) cleaner."""

import logging

import pytest

from src.clean.undp_hdr_clean import UNDPHDRCleaner


@pytest.mark.parametrize(
    "label,expected",
    [
        ("2010-11 D", 2011),
        ("2017/2018 D", 2018),
        ("2019 N", 2019),
        ("1999-00 D", 2000),
        ("2010-2011 D", 2011),
    ],
)
def test_label_accepted_and_mapped_to_end_year(label, expected):
    assert UNDPHDRCleaner._is_survey_year_string(label) is True
    assert UNDPHDRCleaner._survey_end_year(label) == expected


def test_junk_label_rejected_and_logged(caplog):
    with caplog.at_level(logging.WARNING, logger="src.clean.undp_hdr_clean"):
        assert UNDPHDRCleaner._is_survey_year_string("Year and survey") is False
    assert "Year and survey" in caplog.text
