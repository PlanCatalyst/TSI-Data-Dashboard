# Organized Data Layer

## Purpose

`data/organized/` is the consumer-ready data layer between backend processing and
frontend delivery.

It exists so we do **not** force frontend code to understand internal raw/clean
pipeline structures. Instead, backend stages shape data into stable, view-ready
structures that map directly to dashboard needs.

In short:

- `data/raw/` = source-native ingestion snapshots
- `data/clean/` = quality-controlled analytical tables (nulls/dupes/errors handled)
- `data/processed/` = projection and advanced modeling outputs
- `data/organized/` = frontend-consumption organization layer

## What belongs here

Files in this folder should be organized around frontend use-cases and contract
serving, not around source internals.

Examples:

- Versioned contract payloads (`v1/meta.json`, `v1/countries.json`, `v1/timeseries.json`)
- Optional precomputed helper artifacts that reduce frontend compute for specific views
- Validation manifests, schema reports, and publish diagnostics tied to organized outputs

## Design principles

1. **Frontend-oriented**: structures reflect Explore/Compare/Map/About needs.
2. **Contract-stable**: breaking shape changes require version bump (`v1` -> `v2`).
3. **Source-agnostic**: consumers should not care whether data came from UN SDG, WB, ND-GAIN, etc.
4. **Null-safe**: missing observations remain `null` (never sentinel zero).
5. **Join-safe**: `iso3` is the canonical join key.

## Implementation status

The folder is intentionally scaffolded now for growth. As publish and processing
work is completed, modules should write organized outputs here before/while
publishing to Azure Blob.
