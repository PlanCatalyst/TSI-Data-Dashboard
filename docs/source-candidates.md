# Source Candidate Shortlist for Missing Indicators

## Purpose

Provide a pre-approved starting shortlist for **Anthony / Thomas** so source work
can proceed without waiting on PM follow-up.

These candidates align with the client frontend blueprint:
`PlanCatalyst TSI Data Dashboard Final.html`.

## Indicator candidates

### `gii` (Gender Inequality Index) — **live**

- Source: UNDP Human Development Reports, **2025 HDR** release.
- URL: `https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv`
- Version: "2025 HDR" (last-modified `2025-05-05`).
- Raw landing: `data/raw/undp-hdr/composite_indices.csv` (2.0 MB, latin-1 encoded).
- Manifest: `data/raw/undp-hdr/undp_hdr_manifest.json`.
- Clean output: `data/clean/undp-hdr/undp_hdr_clean.csv` (GII contributes 4,600 rows, 1990–2023, 172 countries with at least one observation; 183 with 2023 data).
- Sample check (2023 baseline): AFG=0.665, ALB=0.116, AUS=0.063, range 0.009–0.838 on the expected 0-1 scale.
- Scoring: wired via `GII_INDEX` series_code → `RatioThresholdScorer(threshold=0.32)` in `src/calculating/factory.py`. Direction is vulnerability-oriented in pipeline output; publish step inverts.
- Pillar wiring: `women → women → gii → GII_INDEX` (already in `pillar_taxonomy.py`).
- Caveat: dataset goes back to 1990; other pillar indicators (UN SDG) only have data 2010+, so the `women` pillar will have lonely pre-2010 years in `pillarscores.csv`. Display-year filtering happens at the publish/frontend boundary, not in cleaning.

### `mpi` (Multidimensional Poverty Index) — **live**

- Source: UNDP Human Development Reports + OPHI Global MPI, **2025 release**.
- URL: `https://hdr.undp.org/sites/default/files/publications/additional-files/2025-10/2025_gMPI_Table1and2.xlsx`
- Version: "2025 Global MPI (October 2025)".
- Raw landing: `data/raw/undp-hdr/mpi_table1and2.xlsx` (140 KB XLSX). Requires `openpyxl` (now in `requirements.txt`).
- Clean output: `data/clean/undp-hdr/undp_hdr_clean.csv` (MPI contributes 243 rows, 88 countries, 1–3 survey waves each, survey-end years 2001–2024).
- Sample check (Afghanistan): 2016 wave = 0.234, 2023 wave = 0.268 (worsening, matches recent country conditions).
- Scoring: wired via `MPI_INDEX` series_code → `RatioThresholdScorer(threshold=0.089)` in `src/calculating/factory.py`. Niger 2012 (MPI 0.594) → score 85 (highest need), which inverts to ~15 on the dashboard — correct directionality.
- Pillar wiring: `ctx → poverty → mpi → MPI_INDEX` (already in `pillar_taxonomy.py`).
- **Data-science note for the team**: MPI is **not an annual panel** — each country has 1–2 observations at the household-survey years (DHS/MICS). The cleaner emits one row per survey wave, dated to the *survey-end year* (e.g. "2022/2023 M" → 2023). The publish layer needs a decision on how to display: latest-only, carried-forward, or sparse-by-design. Open question for the contract.
- Name→ISO3: HDR uses UN long forms ("Bolivia (Plurinational State of)"); `_HDR_NAME_TO_ISO3` in the cleaner resolves these. New alias additions go there.

### `mpi` (Multidimensional Poverty Index)

- Primary candidate: UNDP Human Development Reports MPI datasets.
- Frontend source intent: "UNDP Human Development Reports".
- Notes:
  - maintain country/year coverage matrix and explicit nulls where no observation
  - preserve source provenance date/version in ingestion notes

### `ndgain` (ND-GAIN Vulnerability Index) — **live**

- Source: University of Notre Dame, ND-GAIN Country Index 2026 bulk ZIP.
- ZIP path: `data/raw/nd-gain/ndgain_countryindex_2026.zip` (staged in repo; download manually from `https://gain.nd.edu/our-work/country-index/download-data/`).
- Composite path inside ZIP: `resources/vulnerability/vulnerability.csv` (overall, the canonical published composite — same number ND-GAIN itself displays). Sector composites (`food`, `water`, `health`, `ecosystems`, `habitat`, `infrastructure`) are also pulled and tagged `vulnerability_<sector>` for transparency / future scorers, but only `ND_GAIN_VULN` flows to scoring today.
- Clean output: `data/clean/ndgain/nd_gain_clean.csv` (187 countries × 1995–2023 = 5,423 composite rows; sector and component rows are present in the same CSV with `series_code` NaN — defensively ignored by scoring).
- Sample check (2023, top vulnerability): Chad 0.640, Niger 0.633, Solomon Islands 0.629, Micronesia 0.621, Guinea-Bissau 0.613, Sudan 0.612, Somalia 0.611. Matches ND-GAIN's published 2023 ranking.
- Scoring: wired via `ND_GAIN_VULN` series_code → `RatioThresholdScorer(threshold=0.46)` in `src/calculating/factory.py`.
- Pillar wiring: `climate → climate → ndgain → ND_GAIN_VULN` (already in `pillar_taxonomy.py`).
- **Data-science note**: per the yaml's `RatioThreshold(0.46)` formula, any country with vulnerability < 0.46 floors to score 0 (publish to 100). Global 2023 median is ~0.42, so roughly half of countries will tie at dashboard score 100 for the climate pillar. This is the documented behavior, not a bug, but it does flatten the top of the climate ranking visually.

### `state` (State Capacity Proxy) — **live**

- **Source switched** from Hanson-Sigman State Capacity Index (OWID) to **World Bank Worldwide Governance Indicators (WGI) → Government Effectiveness** (2025 release). Reason: Hanson-Sigman froze in 2015, making it unsuitable for current decision-support across fragile states (Afghanistan, Sudan, Ukraine all changed dramatically post-2015). WGI is methodologically stable and annually updated through 2024. Documented in `indicators/indicators.yaml`.
- URL: `https://www.worldbank.org/content/dam/sites/govindicators/doc/wgidataset_with_sourcedata-2025.xlsx`
- Version: "WGI 2025 release" (data 1996–2024).
- Raw landing: `data/raw/world-bank/wgidataset_2025.xlsx` (10 MB).
- Clean output: `data/clean/world-bank/wb_wgi_clean.csv` (5,340 rows = 214 countries × ~29 years).
- Sample check (2024 top capability): Singapore 95.67, Japan 91.94, Luxembourg 91.00, Denmark 88.53, NZ 87.30. Bottom: South Sudan 9.09, Haiti 12.15, Somalia 13.42, Afghanistan 13.74, Yemen 14.93.
- Scoring: wired via `WGI_GOVEFF` series_code → `SimpleDirectionalScorer` in `factory.py`. WGI's 0-100 score is already the favorability score; we just invert (`100 - value`) for vulnerability orientation, then the publish step flips it back so the frontend sees the original WGI number.
- Pillar wiring: `ctx → statecap → state → WGI_GOVEFF` in `pillar_taxonomy.py`.
- New source folder: `data/raw/world-bank/` (alongside the existing World Bank API outputs).

### `state` (legacy: Hanson-Sigman) — **superseded, kept staged**

- The Hanson-Sigman dataset (`data/raw/owid-state-capacity/` if present) is preserved as a reference but is no longer wired. If PlanCatalyst ever wants to re-evaluate, the OWID grapher CSV is at `https://ourworldindata.org/grapher/state-capacity-index.csv` (data 1960–2015).

### `conces` (Concessionality Index) — **deferred future task**

- Status: not implemented. Coverage remains at **27 of 28** indicators live. `conces` is the one outstanding gap.
- Why deferred (not "blocked on data"): the input data exists (World Bank + IMF have all the underlying indicators we'd need), but **the Concessionality Index itself is not a published dataset** — it's a PlanCatalyst-defined composite, and the recipe is not specified in `indicators/indicators.yaml`. The yaml lists four themes but does not say which specific indicators feed each, how they are aggregated within a theme, how the four themes combine, or how the final score is normalized to 0-100. Building it from "best-guess" indicators would put fabricated methodology in front of decision-makers — worse than showing a documented gap.
- Open questions PlanCatalyst must answer before implementation:
  1. **Per-capita income (6 indicators)** — which specific WB/IMF series codes? (Candidates: GNI per capita Atlas, GDP per capita PPP, final household consumption per capita, ...). What weighting?
  2. **Vulnerability and fragility (6 indicators)** — which series? (Candidates: WGI Political Stability, INFORM Risk Index, Fragile States Index sub-indicators, ND-GAIN exposure, ...). What weighting?
  3. **Risk of debt distress (5 indicators)** — which series? (Candidates: IMF Debt Sustainability Analysis risk ratings, WB debt-to-GNI, debt service / exports, ...). What weighting?
  4. **Non-concessional external debt (3 indicators)** — which series? (Candidates: WB IDS external-debt stocks, non-concessional share of total debt, ...). What weighting?
  5. How are the four sub-pillar scores combined into a final concessionality index — equal weight, or some other scheme?
  6. How is the final composite normalized to 0–100 — min-max across countries, percentile rank, or a fixed scale?
- Suggested follow-up: one async written exchange with PlanCatalyst to pin down all six questions. Once answered, the implementation is ~1 day of work — the patterns for both WB API ingestion (`src/fetch/world_bank_fetch.py`) and file-download composites (`src/fetch/wb_wgi_fetch.py`, `src/fetch/undp_hdr_fetch.py`) are now established, so wiring a composite from documented components is straightforward.
- Until then: keep `conces: None` in `NON_SDG_FRONTEND_KEY_TO_SERIES_CODE` and the `pri/macrosec/conces` cell will remain null in the contract.

## Required acceptance criteria per source

1. Source URL and version/date recorded.
2. Fetch and clean path committed in `src/fetch/` + `src/clean/`.
3. Country identity reconciled to `indicators/country_codes.csv` (`iso3` canonical).
4. Missing observations emitted as null-compatible values (no sentinel coercion).
5. Scorer/factory wiring completed or explicitly marked as blocking with owner + ETA.
