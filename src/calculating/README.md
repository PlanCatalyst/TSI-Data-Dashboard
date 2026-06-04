# Data Scoring and Aggregation

## Purpose

This module converts cleaned indicator measurements into standardized scores and
aggregation outputs that feed the publish step.

For frontend delivery, the important outputs are:

- per-indicator scored series
- `pillarscores.csv`
- `subdomainscores.csv`

## Ownership

- **Anthony:** scoring pipeline, indicator gaps (`popdens`, `conces`), cleaning inputs
- **Thomas:** publish integration support, data validation (Phase 2)

## Run Command

```zsh
python3 -m src.calculating.pipeline
```

## Module Map

- `scorers.py`: score formula implementations
- `factory.py`: mapping from `series_code` to scorer implementation
- `pillar_taxonomy.py`: loads `indicators/indicators.yaml` and maps indicators to
  pillar/subdomain keys
- `pillar_aggregate.py`: computes pillar/subdomain aggregates
- `pipeline.py`: orchestrates scoring and writes validated outputs

Legacy compatibility path (not required by frontend contract):

- `aggregate.py`
- `hierarchy.py`
- `weights.py`

## Semantics

- Internal scoring output orientation remains vulnerability-oriented.
- Publish layer is responsible for frontend-facing orientation (`higher_is_better`).
- Missing values remain `null` through publish.

For directionality details, see `indicators/SCORING_AUDIT.md`.

## Output Artifacts

Configured by `paths.data_interim_validated` in `src/config/settings.yaml`.

Typical outputs:

- `Indicator_Scores_Full.csv`
- `indicatorscores/*.csv`
- `pillarscores.csv`
- `subdomainscores.csv`

Optional compatibility outputs:

- `domainscores.csv`
- `sectorscores.csv`
- `subsectorscores.csv`

These compatibility outputs should be treated as transitional and can be removed
after confirming there is no downstream consumer.

## Done Criteria for this module

1. Every required indicator key in taxonomy has deterministic scorer behavior.
2. Pillar and subdomain outputs are generated for all expected countries/years.
3. Missing observations are preserved and not coerced to zero.
4. Artifacts are stable enough for publish without ad hoc cleanup patches.
