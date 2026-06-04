# Pipeline Orchestration

## Purpose

This module coordinates end-to-end execution from raw source fetch to publishable
contract outputs.

Core sequence:

1. Fetch
2. Clean
3. Score/Aggregate
4. Upload validated CSVs (optional Azure)
5. **Publish contract JSON** ← not yet wired in orchestrator; run manually via
   `python3 -m src.upload.publish_dashboard [--azure]` until Anthony wires it in
6. Optional projections processing (post-MVP)

## Ownership

- **Anthony:** pipeline orchestration, publish wiring, Azure automation, cleaning, indicators
- **Thomas:** full-stack integration, frontend presentability, pipeline support

See `TEAM-TASKS.md`.

## Primary Run Command

```zsh
python3 -m src.pipeline.run_pipeline
```

Publish (manual until orchestrator wired):

```zsh
python3 -m src.upload.publish_dashboard          # dry run → data/organized/v1/
python3 -m src.upload.publish_dashboard --azure  # upload to dashboard-public/v1/
```

## Expected Outputs

- Source-cleaned outputs under `data/clean/`
- Scored artifacts under `data/interim/validated/`
- Frontend-oriented organization layer under `data/organized/`
- Published contract JSON under versioned Blob path (`/v1/`)

## Pipeline Success Criteria

1. Run completes without manual intervention (including publish once wired).
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
