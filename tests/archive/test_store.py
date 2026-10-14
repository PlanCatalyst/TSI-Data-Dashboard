from __future__ import annotations

import json
import zipfile

import pandas as pd

from src.archive.store import archive_run


def test_archive_run_copies_flattens_and_inventories(tmp_path):
    raw = tmp_path / "data" / "raw"
    (raw / "unsdg").mkdir(parents=True)
    (raw / "nd-gain").mkdir(parents=True)
    (raw / "world-bank").mkdir(parents=True)
    records = [
        {"series": "SH_DYN_MORT", "geoAreaCode": "404", "geoAreaName": "Kenya", "timePeriodStart": 2015.0, "value": "49", "attributes": {"Nature": "C"}, "Sex": "BOTHSEX"},
        {"series": "SH_DYN_MORT", "geoAreaCode": "404", "geoAreaName": "Kenya", "timePeriodStart": 2016.0, "value": "47", "attributes": {"Nature": "C"}, "Sex": "BOTHSEX"},
        {"series": "SI_POV_NAHC", "geoAreaCode": "076", "geoAreaName": "Brazil", "timePeriodStart": 2020.0, "value": "24", "attributes": {"Nature": "C"}},
    ]
    (raw / "unsdg" / "un_sdg_raw.json").write_text(json.dumps(records))
    (raw / "nd-gain" / "nd_gain_raw.json").write_text(json.dumps([{"ISO3": "KEN", "Name": "Kenya", "1995": 0.5, "1996": 0.51, "indicator": "id_food_01"}]))
    with zipfile.ZipFile(raw / "nd-gain" / "ndgain.zip", "w") as zf:
        zf.writestr("resources/vulnerability/vulnerability.csv", "ISO3,Name,1995\nKEN,Kenya,0.5\n")
    (raw / "world-bank" / "world_bank_raw.json").write_text(json.dumps([{"indicator": {"id": "EN.POP.DNST"}, "countryiso3code": "KEN", "date": "2020", "value": 90.1, "country": {"value": "Kenya"}}]))

    cfg = {"paths": {"data_store": "data/store/", "data_raw": "data/raw/"},
           "paths_by_source": {"raw": {"unsdg": "data/raw/unsdg/", "ndgain": "data/raw/nd-gain/", "worldbank": "data/raw/world-bank/",
                                       "undp_hdr": "data/raw/undp-hdr/", "wb_wgi": "data/raw/world-bank/"}}}
    run_dir = archive_run(cfg, tmp_path, "test-run", log=lambda s: None)

    assert (run_dir / "unsdg" / "files" / "un_sdg_raw.json").read_bytes() == (raw / "unsdg" / "un_sdg_raw.json").read_bytes()
    rec = pd.read_csv(run_dir / "unsdg" / "records.csv")
    assert len(rec) == 3 and "attributes.Nature" in rec.columns and "Sex" in rec.columns
    assert (run_dir / "ndgain" / "extracted" / "ndgain" / "resources" / "vulnerability" / "vulnerability.csv").exists()
    inv = pd.read_csv(run_dir / "inventory.csv")
    mort = inv[(inv.source == "unsdg") & (inv.series == "SH_DYN_MORT")].iloc[0]
    assert mort.countries == 1 and mort.year_min == 2015 and mort.year_max == 2016 and mort.records == 2
    nd = inv[(inv.source == "ndgain")].iloc[0]
    assert nd.year_min == 1995 and nd.year_max == 1996
    assert (tmp_path / "data" / "store" / "LATEST").read_text().strip() == "test-run"
    manifest = json.loads((run_dir / "unsdg" / "manifest.json").read_text())
    assert manifest["files"][0]["sha256"]
