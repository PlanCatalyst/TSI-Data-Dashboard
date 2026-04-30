# Scoring Directionality Audit

**Purpose.** Pin down, once, which direction every indicator score points in, so that:

1. The frontend doesn't have to re-check per-indicator assumptions.
2. The publish step knows exactly where to apply inversions.
3. Gaps between the yaml specification and the current `src/calculating/` implementation are visible to whoever picks up the pipeline work next.

## Headline finding

The dashboard's frontend expects **higher score = more favourable development outcome** (UI colors greener when higher).
The current pipeline in [src/calculating/](src/calculating/) emits **higher score = more vulnerability / greater need** for all 26 scored indicators — the historical orientation for PlanCatalyst's vulnerability framing.

**Required transformation at the publish boundary** (`src/upload/publish_dashboard.py`): apply

```
dashboard_score = 100 - pipeline_score
```

to **every** indicator score and every aggregated pillar/subdomain score before writing JSON. A single invariant at the publish boundary keeps the existing scorers untouched and keeps the frontend code free of per-indicator inversion tables.

## Direction table (28 indicators)

Columns:
- **Raw** — direction of the raw source value (`+` = higher is better, `-` = higher is worse, `?` = contextual).
- **Pipeline score** — direction of the number currently emitted by [src/calculating/](src/calculating/).
- **Needs inversion at publish** — whether `100 - x` must be applied before emitting to the frontend.

| # | frontend_key | pillar | subdomain | series_code | Raw | Pipeline score | Needs inversion | Notes |
|---|---|---|---|---|---|---|---|---|
| 1  | uhc       | health  | phc      | SH_ACS_UNHC_25  | + | higher=need | yes | SimpleDirectional (100 - value) |
| 2  | tb        | health  | infect   | SH_TBS_INCD     | - | higher=need | yes | RatioThreshold(40, 40) |
| 3  | mal       | health  | infect   | SH_STA_MALR     | - | higher=need | yes | RatioThreshold(10, 10) |
| 4  | mmr       | health  | mnch     | SH_STA_MORT     | - | higher=need | yes | RatioThreshold(70, 70) |
| 5  | u5mr      | health  | mnch     | SH_DYN_MORT     | - | higher=need | yes | RatioThreshold(25, 25) |
| 6  | stunt     | health  | nutr     | SH_STA_STNT     | - | higher=need | yes | RatioThreshold(12, 12) |
| 7  | maln      | health  | nutr     | SN_STA_OVWGT    | - | higher=need | yes | RatioThreshold(2.5, 2.5) |
| 8  | anaem     | health  | nutr     | SH_STA_ANEM     | - | higher=need | yes | RatioThreshold(25, 25) |
| 9  | contra    | health  | repro    | SH_FPL_MTMM     | + | higher=need | yes | InverseRatio(11.5) |
| 10 | abr       | health  | repro    | SP_DYN_ADKL     | - | higher=need | yes | RatioThreshold(20) |
| 11 | ihr       | health  | hrisk    | SH_IHR_CAPS     | + | higher=need | yes | SimpleDirectional (100 - value); IHR class-code-weighted inside aggregation |
| 12 | food      | ag      | foodsec  | AG_PRD_FIESMS   | - | higher=need | yes | RatioThreshold(20, 20) |
| 13 | susag     | ag      | foodsec  | AG_LND_SUST     | + | higher=need | yes | RatioGoalInverse(0.04), uses 1/value^2 transform |
| 14 | agoda     | ag      | agrivc   | DC_TOF_AGRL     | + | higher=need | yes | GoalRatio(0.02); normalized to GDP upstream |
| 15 | water     | si      | wash     | SH_H2O_SAFE     | + | higher=need | yes | InverseRatio(27.1) |
| 16 | sanit     | si      | wash     | SH_SAN_SAFE     | + | higher=need | yes | InverseRatio(43.0) |
| 17 | washmort  | si      | wash     | SH_STA_WASHARI  | - | higher=need | yes | RatioThreshold(10, 10) |
| 18 | elec      | si      | energy   | EG_ACS_ELEC     | + | higher=need | yes | InverseRatio(9.8) |
| 19 | clean     | si      | energy   | EG_EGY_CLEAN    | + | higher=need | yes | InverseRatio(30.4) |
| 20 | renew     | si      | energy   | EG_FEC_RNEW     | + | higher=need | yes | InverseRatio(20.0) |
| 21 | finc      | si      | digfin   | FB_BNK_ACCSS    | + | higher=need | yes | InverseRatio(45.0) |
| 22 | gii       | women   | women    | GII_INDEX       | - | higher=need | yes | RatioThreshold(0.32). **Data not yet in pipeline** (UNDP source pending). |
| 23 | ndgain    | climate | climate  | ND_GAIN_VULN    | - | higher=need | yes | RatioThreshold(0.46). **Composite not yet built** — pipeline currently produces ND-GAIN sub-components (`id_ecos_*`, `id_food_*`, etc.), not the aggregated vulnerability score. |
| 24 | state     | ctx     | statecap | (no series_code) | + | — | yes (after impl) | **No scorer registered** in `factory.py`. Raw direction: higher = better (greater state capacity). |
| 25 | pov       | ctx     | poverty  | SI_POV_NAHC     | - | higher=need | yes | RatioThreshold(10, 10) |
| 26 | mpi       | ctx     | poverty  | MPI_INDEX       | - | higher=need | yes | RatioThreshold(0.089). **Data not yet in pipeline** (UNDP source pending). |
| 27 | popdens   | ctx     | ctxmisc  | EN.POP.DNST / POP_DENSITY | ? | see note | ambiguous | **Scorer mismatch**: `DensityScorer` emits `(value / 0.7) * 100`, which does not match the banded formula in [indicators.yaml](indicators.yaml) (>=250 -> 100, >=100 -> 75, >=75 -> 50, >=25 -> 25, else 0). Semantically population density has no universal good/bad direction. |
| 28 | conces    | pri     | macrosec | (no series_code) | ? | — | yes (after impl) | **No scorer registered** in `factory.py`. Raw direction depends on the index construction (Concessionality Index has four sub-pillars; need to confirm with PlanCatalyst). |

## Implementation gaps for the pipeline team

Tracking these so nothing falls through the cracks after handoff:

- **Missing scorers** (2): `state` (State Capacity Index), `conces` (Concessionality Index). Data source and formula notes live in [indicators.yaml](indicators.yaml).
- **Missing data in pipeline** (2): `gii` (GII from UNDP HDR), `mpi` (MPI from UNDP HDR). Needs a new fetch module for the UNDP HDR bulk export.
- **ND-GAIN not composited** (1): `ndgain` — pipeline fetches and cleans the raw ND-GAIN component indicators but does not yet aggregate them into the overall vulnerability score. The scorer exists but has no input.
- **Pop density scorer mismatch** (1): `popdens` — the scorer in [src/calculating/scorers.py](src/calculating/scorers.py) (`DensityScorer`) does not implement the banded 0/25/50/75/100 formula documented in [indicators.yaml](indicators.yaml). Pick one as canonical and reconcile.

Net: **21 of 28 indicators** currently flow end-to-end through scoring as of this audit. 7 have either no data, no scorer, or a mismatched scorer.

## Why invert at publish rather than in `src/calculating/`

Three reasons:

1. **Scorer preservation.** Every scorer in [src/calculating/scorers.py](src/calculating/scorers.py) is written for the vulnerability orientation. Inverting inside `calculating/` would mean auditing and rewriting each scorer — out of scope for this handoff and risky without indicator-by-indicator review.
2. **Single point of truth for the UI contract.** The publish step is the one place that knows "this is what the frontend sees." Scoring direction is part of that contract, not part of pipeline math.
3. **Reversibility.** If a future analytics consumer ever wants the raw vulnerability scores, the publish step can emit both orientations; the pipeline doesn't need to change.

## What the frontend must do with this

Nothing special. Consume the published JSON as "higher is better." No per-indicator inversion table in client code.
