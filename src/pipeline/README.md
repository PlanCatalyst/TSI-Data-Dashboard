# Pipeline Orchestration

## Purpose

This module coordinates end-to-end execution from raw source fetch to publishable
contract outputs.

Core sequence:

1. Fetch
2. Clean
3. Score/Aggregate
4. Publish contract JSON
5. Optional projections processing

## Ownership

- Pipeline/backend integration: Christina + Tyler
- Azure automation/operations: Co-PM
- Source gap inputs: Caroline
- Projections output path: Kayden (data science only)

## Primary Run Command

```zsh
python3 -m src.pipeline.run_pipeline
```

## Expected Outputs

- Source-cleaned outputs under `data/clean/`
- Scored artifacts under `data/interim/validated/`
- Frontend-oriented organization layer under `data/organized/`
- Published contract JSON under versioned Blob path (for example `/v1/`)

## Pipeline Success Criteria

1. Run completes without manual intervention.
2. Publish validation passes against `docs/data-contract.md`.
3. Frontend can read published files from Blob.
4. Failures are observable (logs + alert hooks).

## Failure Policy

- If publish validation fails, abort upload and keep last known-good live payload.
- Do not partially publish contract files.
- Treat schema/key count mismatches as hard failures.

## Notes for AI/Contributors

- Prioritize contract integrity over adding new features.
- Avoid introducing direct frontend dependencies on intermediate CSV structure.
- Keep stage boundaries explicit to simplify debugging and rollback.
