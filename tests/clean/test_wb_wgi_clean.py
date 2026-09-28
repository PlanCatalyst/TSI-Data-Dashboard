from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.clean.wb_wgi_clean import WBWGICleaner


def _tiny_wgi_xlsx(path: Path) -> None:
    df = pd.DataFrame(
        {
            "Economy (name)": ["Kenya", "RegionX"],
            "Economy (code)": ["KEN", "REGION"],
            "Year": [2023, 2023],
            "Governance score (0-100)": [42.0, 50.0],
            "Governance estimate (approx. -2.5 to +2.5)": [-0.4, 0.1],
        }
    )
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="ge", index=False)
        df.to_excel(writer, sheet_name="va", index=False)


def test_wgi_cleaner_reads_yaml_specs_not_stale_manifest(tmp_path, monkeypatch):
    xlsx = tmp_path / "wgi_dataset.xlsx"
    _tiny_wgi_xlsx(xlsx)

    cfg = {
        "wb_wgi": {
            "files": [
                {
                    "alias": "wgi_dataset",
                    "indicators": [
                        {"series_code": "WGI_GOVEFF", "sheet": "ge"},
                        {
                            "series_code": "GE.EST",
                            "sheet": "ge",
                            "score_col": "estimate",
                        },
                        {
                            "series_code": "VA.EST",
                            "sheet": "va",
                            "score_col": "estimate",
                        },
                    ],
                }
            ]
        }
    }
    cleaner = WBWGICleaner(cfg)
    monkeypatch.setattr("src.clean.wb_wgi_clean.project_root", lambda: tmp_path)
    monkeypatch.setattr(
        "src.clean.wb_wgi_clean.get_canonical_name",
        lambda iso3, name: name or iso3,
    )

    manifest = [
        {
            "alias": "wgi_dataset",
            "local_path": xlsx.name,
            "indicators": [{"series_code": "WGI_GOVEFF", "sheet": "ge"}],
        }
    ]
    out = cleaner.clean_data(manifest)
    assert set(out["series_code"]) == {"WGI_GOVEFF", "GE.EST", "VA.EST"}
    assert set(out["country_code"]) == {"KEN"}  # non-ISO3 aggregate dropped
    goveff = out.loc[out["series_code"] == "WGI_GOVEFF", "value"].iloc[0]
    gest = out.loc[out["series_code"] == "GE.EST", "value"].iloc[0]
    assert goveff == 42.0
    assert gest == -0.4
