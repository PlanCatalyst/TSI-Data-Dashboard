"""UNDP HDR MPI: gMPI_Table1 fills coverage gaps, gMPI_Table2 wins on overlap."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from src.clean.undp_hdr_clean import UNDPHDRCleaner


def _mpi_frame(rows: list[tuple[str, int, float]]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "country_code": code,
                "country_name": code,
                "year": year,
                "value": value,
                "indicator": "mpi",
                "series_code": "MPI_INDEX",
            }
            for code, year, value in rows
        ]
    )


@pytest.fixture
def manifest(tmp_path: Path) -> list[dict]:
    mpi_path = tmp_path / "2025_gMPI_Table1and2.xlsx"
    mpi_path.write_bytes(b"not a real workbook, _parse_ophi_mpi_table is mocked")
    return [
        {
            "alias": "mpi",
            "local_path": str(mpi_path.relative_to(Path.cwd())) if mpi_path.is_relative_to(Path.cwd()) else str(mpi_path),
            "format": "ophi_mpi_table",
            "indicators": [
                {"series_code": "MPI_INDEX", "sheet": "gMPI_Table2"},
                {"series_code": "MPI_INDEX", "sheet": "gMPI_Table1"},
            ],
        }
    ]


def test_table2_wins_on_overlapping_wave(monkeypatch, manifest):
    # KEN 2022 is in both tables with different values; POL is Table-1-only
    # (its latest wave has not reached Table 2 yet).
    table2 = _mpi_frame([("KEN", 2022, 0.10)])
    table1 = _mpi_frame([("KEN", 2022, 0.11), ("POL", 2023, 0.02)])

    def fake_parse(self, path, spec, alias=None):
        return table2 if spec.get("sheet") == "gMPI_Table2" else table1

    monkeypatch.setattr(UNDPHDRCleaner, "_parse_ophi_mpi_table", fake_parse)
    monkeypatch.setattr("src.clean.undp_hdr_clean.project_root", lambda: Path("/"))
    monkeypatch.setattr(Path, "exists", lambda self: True)

    cleaner = UNDPHDRCleaner(config={})
    out = cleaner.clean_data(manifest)

    ken = out[(out["country_code"] == "KEN") & (out["year"] == 2022)]
    assert len(ken) == 1
    assert ken.iloc[0]["value"] == pytest.approx(0.10)  # Table 2's value, not Table 1's

    pol = out[(out["country_code"] == "POL") & (out["year"] == 2023)]
    assert len(pol) == 1
    assert pol.iloc[0]["value"] == pytest.approx(0.02)  # Table-1-only wave survives
