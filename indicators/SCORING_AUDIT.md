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
| 13 | susag     | ag      | foodsec  | AG_LND_SUST     | + | higher=need | yes | **Fixed 2026-07-07 (issue #4).** `SimpleDirectionalScorer` (100 − value) on UN SDG's 0–100 proportion scale. Replaced `RatioGoalInverse(0.04)` which was built for a 1–5 band and saturated every value to 0. Sparse coverage (~10–20 countries reporting) is expected. |
| 14 | agoda     | ag      | agrivc   | DC_TOF_AGRL     | + | higher=need | yes | **Fixed 2026-07-07 (issue #3).** `GoalRatioScorer(goal=0.02)` after normalising raw USD-millions to ag-flow/GDP via World Bank `NY.GDP.MKTP.CD` join in `pipeline.score_indicators`. |
| 15 | water     | si      | wash     | SH_H2O_SAFE     | + | higher=need | yes | InverseRatio(27.1) |
| 16 | sanit     | si      | wash     | SH_SAN_SAFE     | + | higher=need | yes | InverseRatio(43.0) |
| 17 | washmort  | si      | wash     | SH_STA_WASHARI  | - | higher=need | yes | RatioThreshold(10, 10) |
| 18 | elec      | si      | energy   | EG_ACS_ELEC     | + | higher=need | yes | InverseRatio(9.8) |
| 19 | clean     | si      | energy   | EG_EGY_CLEAN    | + | higher=need | yes | InverseRatio(30.4). **Fixed 2026-07-07 (issue #5).** `EG_EGY_CLEAN` rows were absent from on-disk `un_sdg_clean.csv` (stale snapshot predating 7.1.2 coverage). Re-fetch + clean restores 8,730 country-year rows. |
| 20 | renew     | si      | energy   | EG_FEC_RNEW     | + | higher=need | yes | InverseRatio(20.0) |
| 21 | finc      | si      | digfin   | FB_BNK_ACCSS    | + | higher=need | yes | InverseRatio(45.0) |
| 22 | gii       | women   | women    | GII_INDEX       | - | higher=need | yes | RatioThreshold(0.32). **Live (2026-05-17)** — UNDP HDR 2023-24 composite-indices CSV, 1990–2022, 166 countries. See `docs/source-candidates.md`. |
| 23 | ndgain    | climate | climate  | ND_GAIN_VULN    | - | higher=need | yes | RatioThreshold(0.46). **Live (2026-05-17)** — pulls ND-GAIN's published composite from `resources/vulnerability/vulnerability.csv` in the 2026 ZIP, 187 countries, 1995–2023. Component / sector rows remain in the cleaned CSV un-scored (defensive series_code filter). |
| 24 | state     | ctx     | statecap | WGI_GOVEFF      | + | higher=need | yes | SimpleDirectional (100 - value). **Live (2026-05-17)** — source switched from Hanson-Sigman (stopped 2015) to World Bank WGI Government Effectiveness (current through 2024); WGI's 0-100 score used directly. See `docs/source-candidates.md`. |
| 25 | pov       | ctx     | poverty  | SI_POV_NAHC     | - | higher=need | yes | RatioThreshold(10, 10) |
| 26 | mpi       | ctx     | poverty  | MPI_INDEX       | - | higher=need | yes | RatioThreshold(0.089). **Live (2026-05-17)** — UNDP HDR + OPHI 2025 Global MPI Table 2, 88 countries, 1–3 survey waves each (2001–2024). See `docs/source-candidates.md`. |
| 27 | popdens   | ctx     | ctxmisc  | EN.POP.DNST | ? | higher=need | yes | **Verified 2026-07-07 (issue #6).** Banded formula produces 0/25/50/75/100. **Display direction confirmed 2026-09-17:** denser = higher need in the pipeline, so after the publish invert a country at ≥250/km² *displays* 0. Keep scored + inverted. No code change. |
| 28 | mspi      | pri     | macrosec | MSPI_INDEX | + | higher=need | yes | **Scored 2026-09-19.** Composer `src/calculating/mspi.py`; `SimpleDirectionalScorer` flips to higher=need. **Coverage:** 117 countries / 1,693 country-years (2010–2024) vs HDI 193 / 2,688 in the same window. High-income DRS-non-reporters are null (USA, GBR, DEU, …). Spec: `docs/spec-macrosec-index.md`. Confirm with PlanCatalyst before swapping the live snapshot. |

## Implementation gaps for the pipeline team

Tracking these so nothing falls through the cracks after handoff:

- **Missing scorers** (0): `mspi` composer is wired and scored (`MSPI_INDEX` / `SimpleDirectionalScorer`). Coverage is thinner than HDI (117 vs 193 countries, 2010–2024). `state` uses `WGI_GOVEFF` (live 2026-05-17).
- **Missing data in pipeline** (0): `gii` and `mpi` are both live as of 2026-05-17. `gii` uses the 2025 HDR composite-indices CSV; `mpi` uses the 2025 OPHI/UNDP Global MPI Table 2 XLSX (88 countries, survey-wave granularity). Note: MPI is not an annual panel — display logic decision still open.
- **ND-GAIN composite** (was 1, now 0): `ndgain` is live as of 2026-05-17 — pipeline now reads ND-GAIN's published composite directly from `resources/vulnerability/vulnerability.csv` rather than recomputing from components. Matches ND-GAIN's canonical published numbers by construction.
- **Pop density scorer** (formula fixed and verified): `popdens` — banded formula adopted 2026-07-03 (`b19f1a8`), verified 2026-07-07 (issue #6). Display direction confirmed 2026-09-17: keep scored + inverted.

### Reconciliation with published output (2026-07-07 run)

| Indicator | GitHub issue | Verdict | Evidence (2026-07-07 run) |
|---|---|---|---|
| `agoda` | #3 | **Fixed** | 179/2134 pipeline zeros (was 2122); `ag` pillar = 100 for 52/187 countries with ag data (was 182/216) |
| `susag` | #4 | **Fixed** | Varied scores 0–89 on 0–100 scale; sparse coverage (~20 countries) expected |
| `clean` | #5 | **Fixed** | 8,730 `EG_EGY_CLEAN` rows scored; `clean.csv` produced |
| `popdens` | #6 | **Verified** | Banded scores {0, 25, 50, 75, 100}; 3,617 non-null scores |

**Net:** 28/28 indicators reach scoring. `popdens` direction is closed (2026-09-17). The `pri/macrosec` contract key is `mspi` backed by `MSPI_INDEX` (scored 2026-09-19: 117 countries vs HDI 193). Do not live-publish until PlanCatalyst confirms that coverage drop.

Open semantic question: none.

### conces / macrosec — spec received 2026-09-17; contract key `mspi` as of 2026-09-19

PlanCatalyst declined the HDI substitution (2026-08-13) and supplied the Country Macro
Socio-Economic Performance Index on 2026-09-17. Spec: `docs/spec-macrosec-index.md`
(`index_version: "1.1"`, revised 2026-09-23, scope refinement 2026-09-29). Four equal-weight World Bank components (income, WGI fragility,
LIC-DSF debt-risk proxy, non-concessional share); null if any component is null; higher =
better before the pipeline invert.

The 2026-06-28 MVP-exclusion proposal is **withdrawn**. Contract key is `mspi` (not `hdi`,
not `conces`). Taxonomy maps `mspi` → `MSPI_INDEX` (`src/calculating/mspi.py`).
**Coverage vs HDI (local score 2026-09-19):** 117 countries / 1,693 country-years vs 193 / 2,688
in 2010–2024. Binding constraint is IDS (`DT.DOD.ALLC.ZS` + debt-risk). High-income non-reporters
are null. Face-value debt stock was used for 1,585 rows; present-value for 103. Confirm before
swapping the live snapshot.

## Why invert at publish rather than in `src/calculating/`

Three reasons:

1. **Scorer preservation.** Every scorer in [src/calculating/scorers.py](src/calculating/scorers.py) is written for the vulnerability orientation. Inverting inside `calculating/` would mean auditing and rewriting each scorer — out of scope for this handoff and risky without indicator-by-indicator review.
2. **Single point of truth for the UI contract.** The publish step is the one place that knows "this is what the frontend sees." Scoring direction is part of that contract, not part of pipeline math.
3. **Reversibility.** If a future analytics consumer ever wants the raw vulnerability scores, the publish step can emit both orientations; the pipeline doesn't need to change.

## What the frontend must do with this

Nothing special. Consume the published JSON as "higher is better." No per-indicator inversion table in client code.
