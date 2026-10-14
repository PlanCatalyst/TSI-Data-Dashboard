# Raw data store

**Purpose.** A lossless, inventoried copy of every source payload the
pipeline fetched, written per run right after the fetch stage. It is the
fork point for the independent data audit (`audit/README.md`): the pipeline
reads the same bytes, so every published number can be traced to a raw
record, and an auditor can re-derive numbers without touching the pipeline.

**Where.** `data/store/<run_id>/`, gitignored, local only. `data/store/LATEST`
holds the newest run id. The run id is the same one stamped on the published
snapshot (`meta.pipelineRunId`), so a dashboard state points at its store.

## Layout

```
data/store/<run_id>/
  manifest.json          run id, capture time, sources, file names
  INVENTORY.md           per source and series: countries, years, records
  inventory.csv          the same, machine readable
  <source>/
    files/               byte-for-byte copies of the raw files, sha256 in manifest
    extracted/           every zip member (ND-GAIN)
    sheets/              every xlsx sheet as CSV (WGI, MPI)
    records.csv          every API record flattened, every field kept (UN SDG, World Bank, ND-GAIN)
    manifest.json        files, hashes, inventory rows for this source
```

Sources: `unsdg`, `worldbank`, `wb_country_metadata`, `ndgain`, `undp_hdr`,
`wb_wgi`. Nested JSON fields are dotted (`attributes.Nature`, `indicator.id`);
lists stay as JSON strings. Nothing is filtered, nothing is dimension-selected.

## When it runs

- Pipeline: stage "raw store" after fetch, on by default
  (`runtime.archive_raw`, env `PIPELINE_ARCHIVE_RAW`). With `fetch_raw` off
  it archives whatever is in `data/raw/`, which is still what the run reads.
- By hand: `python3 scripts/archive_raw.py --run-id <id>` to capture the
  current `data/raw/` without fetching. `baseline-20260714` is the snapshot
  the 2026-10-14 review looked at.

## Fetch window

UN SDG and World Bank are fetched from 1990 (changed from 2010 on
2026-10-14). The dashboard axis starts at 1990; before this change health,
agriculture and infrastructure had no values before 2010 by construction.

## Reading it

Inventory first: `INVENTORY.md` answers "what do we hold" per series. For a
single number: find the series in `<source>/records.csv`, filter country and
year, and compare with `dashboard/public/v1/timeseries.json` through the
scoring rule in `indicators/SCORING_AUDIT.md`. The audit scripts under
`audit/` do exactly this at scale.
