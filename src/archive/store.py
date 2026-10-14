"""Raw data store.

After the fetch stage, copy every raw file for every source into
data/store/<run_id>/<source>/ exactly as fetched, extract archives and
spreadsheets into plain CSV, flatten every API record into one records.csv
with every field kept, and write an inventory of what the run holds: per
source and series, which countries, which years, how many records.

Nothing here filters, selects a dimension or scores. The store is the fork
point for the independent audit (audit/README.md): the pipeline reads the
same bytes, so every published number can be traced to a record here.

Layout per run:
    data/store/<run_id>/
        manifest.json          run id, time, sources, file hashes
        INVENTORY.md           human summary
        inventory.csv          source, series, countries, year_min, year_max, records
        <source>/
            files/             byte-for-byte copies of the raw files
            extracted/         zip members, one folder per archive
            sheets/            one CSV per xlsx sheet
            records.csv        flattened API records (JSON sources only)
            manifest.json      per-source detail
    data/store/LATEST          the most recent run id
"""
from __future__ import annotations

import csv
import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

import pandas as pd

Log = Callable[[str], None]

# Which raw folder and which detector each source uses. The detector finds
# the country, year and series columns in a flattened frame so the inventory
# can count without knowing the source's schema in advance.
SOURCES: dict[str, dict[str, Any]] = {
    "unsdg": {"dir_key": "unsdg", "json": "un_sdg_raw.json",
              "country": "geoAreaCode", "country_name": "geoAreaName", "year": "timePeriodStart", "series": "series"},
    "worldbank": {"dir_key": "worldbank", "json": "world_bank_raw.json",
                  "country": "countryiso3code", "country_name": "country.value", "year": "date", "series": "indicator.id"},
    "wb_country_metadata": {"dir_key": "worldbank", "json": "world_bank_country_metadata_raw.json",
                            "country": "id", "country_name": "name", "year": None, "series": None},
    "ndgain": {"dir_key": "ndgain", "json": "nd_gain_raw.json",
               "country": "ISO3", "country_name": "Name", "year": "__wide__", "series": "indicator"},
    "undp_hdr": {"dir_key": "undp_hdr", "json": None, "manifest": "undp_hdr_manifest.json"},
    "wb_wgi": {"dir_key": "wb_wgi", "json": None, "manifest": "wb_wgi_manifest.json"},
}


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _flatten_records(records: list[dict]) -> pd.DataFrame:
    """Every field of every record, nested dicts dotted, lists kept as JSON."""
    if not records:
        return pd.DataFrame()
    df = pd.json_normalize(records, sep=".")
    for col in df.columns:
        if df[col].map(lambda v: isinstance(v, (list, dict))).any():
            df[col] = df[col].map(lambda v: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v)
    return df


def _year_series(df: pd.DataFrame, spec: dict) -> tuple[pd.Series | None, pd.Series | None]:
    """Return (year, series) columns for inventory counting."""
    ycol, scol = spec.get("year"), spec.get("series")
    if ycol == "__wide__":
        year_cols = [c for c in df.columns if str(c).isdigit() and 1900 < int(c) < 2100]
        if not year_cols:
            return None, df[scol] if scol in df else None
        long = df.melt(id_vars=[c for c in df.columns if c not in year_cols], value_vars=year_cols, var_name="year", value_name="value")
        long = long[long["value"].notna()]
        return long["year"].astype(int), long[scol] if scol in long else None
    year = pd.to_numeric(df[ycol], errors="coerce") if ycol and ycol in df else None
    series = df[scol] if scol and scol in df else None
    return year, series


def _inventory_rows(source: str, df: pd.DataFrame, spec: dict) -> list[dict]:
    if df.empty:
        return [{"source": source, "series": "", "countries": 0, "year_min": "", "year_max": "", "records": 0}]
    ccol = spec.get("country")
    year, series = _year_series(df, spec)
    if spec.get("year") == "__wide__":
        year_cols = [c for c in df.columns if str(c).isdigit() and 1900 < int(c) < 2100]
        long = df.melt(id_vars=[c for c in df.columns if c not in year_cols], value_vars=year_cols, var_name="year", value_name="value")
        long = long[long["value"].notna()].assign(year=lambda d: d["year"].astype(int))
        work = long
    else:
        work = df.assign(year=year) if year is not None else df.assign(year=pd.NA)
    scol = spec.get("series")
    groups = work.groupby(scol, dropna=False) if scol and scol in work else [("", work)]
    rows = []
    for key, g in groups:
        yrs = pd.to_numeric(g["year"], errors="coerce").dropna()
        rows.append({
            "source": source,
            "series": "" if key is None or (isinstance(key, float) and pd.isna(key)) else str(key),
            "countries": int(g[ccol].nunique()) if ccol and ccol in g else 0,
            "year_min": int(yrs.min()) if len(yrs) else "",
            "year_max": int(yrs.max()) if len(yrs) else "",
            "records": int(len(g)),
        })
    return rows


def _extract(path: Path, out_dir: Path, log: Log) -> list[str]:
    written: list[str] = []
    if path.suffix.lower() == ".zip":
        dest = out_dir / "extracted" / path.stem
        dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(path) as zf:
            zf.extractall(dest)
            written = [str((dest / n).relative_to(out_dir)) for n in zf.namelist() if not n.endswith("/")]
        log(f"  extracted {len(written)} members from {path.name}")
    elif path.suffix.lower() in (".xlsx", ".xls"):
        dest = out_dir / "sheets"
        dest.mkdir(parents=True, exist_ok=True)
        sheets = pd.read_excel(path, sheet_name=None, header=None)
        for name, df in sheets.items():
            safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in str(name))
            target = dest / f"{path.stem}__{safe}.csv"
            df.to_csv(target, index=False, header=False)
            written.append(str(target.relative_to(out_dir)))
        log(f"  wrote {len(written)} sheets from {path.name}")
    return written


def archive_source(source: str, raw_dir: Path, run_dir: Path, log: Log) -> dict:
    spec = SOURCES[source]
    out = run_dir / source
    (out / "files").mkdir(parents=True, exist_ok=True)
    files: list[dict] = []
    inventory: list[dict] = []

    candidates: list[Path] = []
    if spec.get("json"):
        p = raw_dir / spec["json"]
        if p.exists():
            candidates.append(p)
    if spec.get("manifest"):
        m = raw_dir / spec["manifest"]
        if m.exists():
            candidates.append(m)
            for rec in json.loads(m.read_text(encoding="utf-8")):
                lp = rec.get("local_path")
                if lp and (Path(lp).is_absolute() or (raw_dir.parents[2] / lp).exists()):
                    candidates.append(Path(lp) if Path(lp).is_absolute() else raw_dir.parents[2] / lp)
    # ND-GAIN: the zip the fetcher read sits beside its json
    if source == "ndgain":
        candidates += sorted(raw_dir.glob("*.zip"))

    seen = set()
    for p in candidates:
        if p in seen or not p.exists():
            continue
        seen.add(p)
        copy = out / "files" / p.name
        shutil.copy2(p, copy)
        entry = {"name": p.name, "bytes": p.stat().st_size, "sha256": _sha256(p), "from": str(p)}
        entry["derived"] = _extract(copy, out, log)
        files.append(entry)

    if spec.get("json"):
        p = raw_dir / spec["json"]
        if p.exists():
            records = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(records, list):
                df = _flatten_records(records)
                df.to_csv(out / "records.csv", index=False, quoting=csv.QUOTE_MINIMAL)
                inventory = _inventory_rows(source, df, spec)
                log(f"  {source}: {len(df)} records, {len(df.columns)} fields")
    if not inventory:
        inventory = [{"source": source, "series": f.get("name", ""), "countries": "", "year_min": "", "year_max": "", "records": ""} for f in files]

    manifest = {"source": source, "raw_dir": str(raw_dir), "files": files, "inventory": inventory}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def archive_run(cfg: dict, root: Path, run_id: str, log: Log = print) -> Path:
    """Archive every source's raw files for this run. Returns the run dir."""
    store_root = root / ((cfg.get("paths") or {}).get("data_store") or "data/store/")
    run_dir = store_root / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    by_source = ((cfg.get("paths_by_source") or {}).get("raw") or {})
    manifests = []
    inventory: list[dict] = []
    for source, spec in SOURCES.items():
        rel = by_source.get(spec["dir_key"]) or (cfg.get("paths") or {}).get("data_raw", "data/raw/")
        raw_dir = root / rel
        if not raw_dir.exists():
            log(f"  {source}: raw dir {raw_dir} missing, skipped")
            continue
        m = archive_source(source, raw_dir, run_dir, log)
        manifests.append({"source": source, "files": [f["name"] for f in m["files"]]})
        inventory += m["inventory"]

    inv = pd.DataFrame(inventory, columns=["source", "series", "countries", "year_min", "year_max", "records"])
    inv.to_csv(run_dir / "inventory.csv", index=False)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"# Raw data store: run {run_id}", "", f"Captured {stamp}. Every file below is byte-identical to what the pipeline read; "
             "hashes in manifest.json. records.csv per source keeps every field of every record.", "",
             "| Source | Series | Countries | Years | Records |", "|---|---|---:|---|---:|"]
    for r in inv.itertuples(index=False):
        yrs = f"{r.year_min} to {r.year_max}" if r.year_min != "" else ""
        lines.append(f"| {r.source} | `{r.series}` | {r.countries} | {yrs} | {r.records} |")
    (run_dir / "INVENTORY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (run_dir / "manifest.json").write_text(json.dumps({"run_id": run_id, "captured": stamp, "sources": manifests}, indent=2), encoding="utf-8")
    (store_root / "LATEST").write_text(run_id + "\n", encoding="utf-8")
    log(f"raw store: {run_dir} ({len(inv)} inventory rows)")
    return run_dir
