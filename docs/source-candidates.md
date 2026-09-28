# Source Candidate Shortlist for Missing Indicators

## Purpose

Provide a pre-approved starting shortlist so source work can proceed without
waiting on PM follow-up.

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
- Clean output: `data/clean/world-bank/wb_wgi_clean.csv`. `WGI_GOVEFF` remains
  the 0-100 GE score (~5,340 rows). As of 2026-09-19 the same file also carries
  native EST estimates (`VA.EST` … `CC.EST`, approx. −2.5 to +2.5) for `mspi`
  fragility. Do not reuse `WGI_GOVEFF` for that component.
- Sample check (2024 top capability): Singapore 95.67, Japan 91.94, Luxembourg 91.00, Denmark 88.53, NZ 87.30. Bottom: South Sudan 9.09, Haiti 12.15, Somalia 13.42, Afghanistan 13.74, Yemen 14.93.
- Scoring: wired via `WGI_GOVEFF` series_code → `SimpleDirectionalScorer` in `factory.py`. WGI's 0-100 score is already the favorability score; we just invert (`100 - value`) for vulnerability orientation, then the publish step flips it back so the frontend sees the original WGI number.
- Pillar wiring: `ctx → statecap → state → WGI_GOVEFF` in `pillar_taxonomy.py`.
- New source folder: `data/raw/world-bank/` (alongside the existing World Bank API outputs).

### `state` (legacy: Hanson-Sigman) — **superseded, kept staged**

- The Hanson-Sigman dataset (`data/raw/owid-state-capacity/` if present) is preserved as a reference but is no longer wired. If PlanCatalyst ever wants to re-evaluate, the OWID grapher CSV is at `https://ourworldindata.org/grapher/state-capacity-index.csv` (data 1960–2015).

### `conces` / macrosec composite — **scored 2026-09-19; coverage drop vs HDI**

- Status: formula is in `docs/spec-macrosec-index.md` (`index_version: "1.0"`).
  Contract key `mspi` landed 2026-09-19. Composer emits `MSPI_INDEX`; taxonomy
  maps `mspi` → `MSPI_INDEX`. Local score: **117 countries / 1,693 country-years**
  (2010–2024) vs HDI **193 / 2,688**. `DT.DOD.ALLC.ZS` and `DT.DOD.DECT.EX.ZS`
  are archived on WDI and must be fetched from IDS source 6 with counterpart-area
  WLD. Do not live-publish until PlanCatalyst confirms the coverage drop.
- Why it was deferred: the Concessionality Index was never a published dataset. PlanCatalyst
  has now specified a four-component World Bank composite (equal 25% weights, fixed bounds,
  null if any component is null). The six methodology questions below are answered.
- Answers (2026-09-17 spec):
  1. **Per-capita income** — `NY.GDP.PCAP.CD`, log then fixed min-max ln(200)–ln(150,000). 25%.
  2. **Vulnerability and fragility** — mean of WGI EST dimensions `VA, PV, GE, RQ, RL, CC`,
     fixed min-max −2.5 to +2.5. Skip missing dimensions. 25%. Do not reuse `WGI_GOVEFF`.
  3. **Risk of debt distress** — LIC-DSF proxy from IDS PV (`DT.DOD.PVLX.*`, face-value
     fallback `DT.DOD.DECT.*`) plus `DT.TDS.DECT.EX.ZS`, tiered on `avg_wgi`. Categorical
     1.0 / 0.5 / 0.0. 25%.
  4. **Non-concessional external debt** — invert `DT.DOD.ALLC.ZS`. 25%.
  5. Four components combined by **equal weight**.
  6. Normalized on **fixed absolute bounds**, clipped to [0, 1], then × 100. Not
     cross-country min-max, not percentile rank.
- Implementation is unblocked. Owner: **Thomas** (finishing the project solo as of
  2026-09-19). Contract key is `mspi`. Flag coverage drop vs HDI before swapping
  the live snapshot. Composer is in `src/calculating/mspi.py`.

## Required acceptance criteria per source

1. Source URL and version/date recorded.
2. Fetch and clean path committed in `src/fetch/` + `src/clean/`.
3. Country identity reconciled to `indicators/country_codes.csv` (`iso3` canonical).
4. Missing observations emitted as null-compatible values (no sentinel coercion).
5. Scorer/factory wiring completed or explicitly marked as blocking with owner + ETA.
