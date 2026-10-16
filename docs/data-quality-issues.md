# Data quality issue log

Every defect seen on the dashboard gets an entry here before it gets a fix.
Each entry names the validation rule in `src/validation/rules.py` that catches
it, or says why it cannot be caught in data. New bug: new entry, then a rule
where one is possible, then the fix. The validation stage runs between score
and publish and blocks the run on any `block` finding; the report lands in
`data/interim/validated/data_quality_report.md`.

Status values: open, fixed (date, commit), decision (waits on the client).

| ID | Symptom | Rule | Status |
|----|---------|------|--------|
| DQ-01 | Country scores 100 on most pillars with no trend (Russia, Brazil climate) | R4 warn, R5 warn | decision |
| DQ-02 | Series alternates between two levels every other year (adolescent births in 81 countries, IHR capacity in 4) | R1 block, R3 block | fixed 2026-10-14 |
| DQ-03 | Every country's overall line zigzags 1995 to 2002; regional averages too | R6 block | fixed 2026-10-14 |
| DQ-04 | Regional average ramps to 100 in early years then drops | none (frontend rule) | fixed 2026-10-14 |
| DQ-05 | Pillar score swings on a single indicator (Brazil agriculture 0.7 from 1 of 3) | R7 warn | partly fixed |
| DQ-06 | A score with no source value, or outside 0 to 100 (93 ghost zeros found) | R2 block | fixed 2026-10-14 |
| DQ-07 | Row with a non-ISO3 country code or an impossible year | R8, R9 block | guarded |
| DQ-08 | Agriculture aid flows sawtooth in 6 countries | R3 warn | open, likely real |
| DQ-09 | Sawtooth in one country only (Niue TB incidence) | R3 warn | open, likely real |
| DQ-10 | Agriculture aid scored 100 where GDP is missing (60 country-years, North Korea, Eritrea, South Sudan, Yemen, Cuba, Syria, Turks and Caicos) | R10 block | fixed 2026-10-15 |
| DQ-11 | Water, sanitation and poverty scored from urban-only rows (482 country-years in 22 countries, among them China, Australia, Saudi Arabia and Argentina) | R11 block | fixed 2026-10-15 |
| DQ-12 | Andorra has no state capacity series (WGI legacy code ADO) | none (R8 checks shape only) | fixed 2026-10-15 |
| DQ-13 | One MPI survey wave never published (Senegal 2010-11) | none (row never enters the pipeline); cleaner logs rejected labels | fixed 2026-10-15 |
| DQ-14 | Macro security index scored from a partial debt-risk input (15 country-years) | none yet; R12 once decided | decision |

---

## DQ-01 Benchmark clamp pins better-than-benchmark countries at 100

**Seen:** Russia shows 100 for agriculture, social infrastructure, gender
equality and climate; Brazil climate flat at 100 since 1995.
**Evidence:** `scripts/clamp_audit.py`: 58.5% of ND-GAIN country-years
pinned, 72.3% of electricity access, 70.2% of adolescent births. Russia's
values are real (under-five mortality, water, electricity, GII, ND-GAIN) and
all sit on the better side of the client benchmark.
**Cause:** `RatioThresholdScorer` and `InverseRatioScorer` floor need at 0
below the benchmark (`docs/requirements-v2.md` section 1). Not a data error.
**Rule:** R4 warns on a score flat for 10+ years while the source moves
(AC1.1); R5 warns when more than half an indicator's country-years are
pinned. Both become `block` once the scoring decision is made.
**Fix:** built as `scoring.below_benchmark: soft_floor`, default off.
Waits on the reviewer (requirements section 1.4).

## DQ-02 Disaggregated rows collapse to an arbitrary one per year

**Seen:** Brazil reproductive health 2010 to 2022 alternates 100, 31, 100,
31. Same pattern in 81 countries for adolescent births and 4 for IHR.
**Evidence:** `data/clean/unsdg/un_sdg_clean.csv` has two rows per year for
`SP_DYN_ADKL` (age 10-14 at ~3 per 1,000 and 15-19 at ~60) and thirteen rows
for `SH_IHR_CAPS` (one per capacity). The publisher kept totals where a
total existed and otherwise took the first row, which is row-order dependent.
**Cause:** no explicit dimension selection before scoring. Eleven SDG series
carry multiple rows per country-year.
**Rule:** R1 blocks when rows with conflicting values survive selection; R3
blocks any series with three or more sign-alternating jumps of 25+ points.
**Fix:** `src/calculating/dimensions.py` runs before scoring: 15-19 band for
adolescent births (the SDG 3.7.2 definition and the benchmark's scale), mean
over the 13 capacities for IHR, generic totals otherwise, identical
duplicates collapsed, conflicting ones left for R1. Tests in
`tests/calculating/test_dimensions.py`.

## DQ-03 Composition zigzag: the basket changes from year to year

**Seen:** every country's overall trend and every region's average zigzag
between 1995 and 2002. Kazakhstan, Brazil, Venezuela, Russia all show it.
**Evidence:** for Brazil, 1996 averages women, climate and governance
(70.5); 1997 averages women and climate only (80.2); 1998 is back to three
(69.7). Governance (World Bank WGI) is biennial before 2002 and climate is
pinned at 100, so the mean alternates between two baskets. No single value is
wrong.
**Cause:** subdomain, pillar, overall and regional means were taken over
"whatever reported that year", in both the pipeline and the frontend.
**Rule:** R6 blocks any aggregated score whose member count is below the
basket rule; it also blocks if the aggregation output lacks the basket
columns, so the rule cannot be bypassed.
**Fix:** basket mean in `src/calculating/pillar_aggregate.py` and mirrored
as `basketSeries` in `dashboard/src/data/contract/selectors.ts`: basket =
members with a value in the last 5 years of the series; a year is scored
only when at least 75% of the basket is present; members outside the basket
are ignored. Years with an incomplete basket are null, not interpolated. The
panel's overall line, the Explore regional "Overall" line and the pillar
series all use it. Side effect: long early series that rested on one or two
pillars disappear; that is the honest picture.

## DQ-04 Regional average inflated by sparse early years

**Seen:** regional lines ramp to 100 around 1995 to 2001 then drop in the
final year.
**Cause:** the regional mean over the few countries reporting in those years.
**Fix (frontend only):** years where fewer than half of a region's countries
report are not drawn, with a note under the chart. No pipeline rule because
the regional view is derived on the client.

## DQ-05 Pillar score rests on one indicator

**Seen:** Brazil agriculture 0.7 "severe need" from 1 of 3 indicators, series
jumping between about 50 and 0.
**Rule:** R7 warns per pillar when a pillar-year rests on one subdomain of a
basket of three or more.
**Fix:** the detail panel shows an "n of m" badge on low-confidence rows; the
basket rule removes single-member years that were outside the basket. A
minimum-coverage rule that hides the score entirely is a client decision
(requirements section 1.6).

## DQ-06 Score shape: a missing value became a score

**Seen:** on the first validation run, R2 found 93 country-years (electricity
access 15, renewables 78) with a score and no source value. They published
as 100 on the dashboard.
**Cause:** `InverseRatioScorer` compared the gap against the benchmark with
`where(gap >= benchmark, 0)`; NaN compares False, so a missing value was
treated as better than benchmark and floored to need 0.
**Rule:** R2 blocks a score outside 0 to 100 and a score with no source
value. Nulls stay null end to end (hard invariant 3).
**Fix:** `isna()` guard in the clamp branch, tests in
`tests/calculating/test_scorers.py`. Fixed 2026-10-14.

## DQ-07 Identity and time

**Rule:** R8 blocks any country code that is not three uppercase letters
after harmonisation; R9 blocks an impossible year.

## DQ-08 Agriculture aid flows sawtooth

**Seen:** `DC_TOF_AGRL` alternates in six countries.
**Evidence:** no duplicate rows; aid disbursements are lumpy by nature.
**Rule:** R3 reports it as a warning (series listed in
`src/validation/run.py` `LUMPY_SERIES`), not a block.
**Status:** open. Candidate treatment: a three-year rolling mean before
scoring, to be decided with the client.

## DQ-09 Sawtooth in a single country

**Seen:** Niue TB incidence alternates between 0 and high values; bank
account ownership in Georgia, Serbia and Venezuela did the same before the
15+ rule landed.
**Cause:** with a population near 1,600, a handful of cases moves the rate by
hundreds per 100,000. Real data, not processing.
**Rule:** R3 blocks a sawtooth only when it appears in three or more
countries of one series; a lone country warns under this entry.
**Status:** open. Candidate treatment: a minimum-population rule for
rate-based indicators, to be decided with the client.

## DQ-10 Agriculture aid scored as a ratio while still in USD millions

**Seen:** agriculture aid flows show 100 (best) for 60 country-years: North
Korea 2000 to 2024, Eritrea 2012 to 2024, South Sudan 2016 to 2024, Yemen 2019
to 2024, Cuba 2021 to 2024, Syria 2023 to 2024, Turks and Caicos 2000.
**Evidence:** `indicatorscores/agoda.csv` for Cuba holds 0.000351 in 2020 (a
ratio) and 27.1 in 2021 (raw USD millions). World Bank GDP ends in 2020 for
Cuba and is null for every North Korea year.
**Cause:** `_apply_agoda_gdp_normalization` in `src/calculating/pipeline.py`
converted only rows where the GDP join succeeded and wrote the rest back
unconverted. 27.1 against a 0.02 goal floors need to 0, published as 100. R2
could not see it: the score is in range and a source value exists.
**Rule:** R10 blocks any DC_TOF_AGRL value above 1 after normalisation (aid
above 100% of GDP is a unit error).
**Fix:** a country-year without GDP gets a null value, including the case
where GDP is absent altogether. Tests in
`tests/calculating/test_agoda_normalization.py`. Whether to fall back to
another GDP source for these countries is a separate client question.

## DQ-11 Urban-only rows published as national values

**Seen:** safe water and sanitation scores for China, Australia, Saudi
Arabia, Argentina, the USA and others that are really urban figures; Saudi
Arabia and the USA showed 100.
**Evidence:** for these country-years the UN SDG API returns only
`Location = URBAN` for `SH_SAN_SAFE` and `SH_H2O_SAFE`; no ALLAREA row exists.
`indicatorscores/sanit.csv` carried `location = URBAN` rows. Counts: sanitation
302, water 171, poverty (Argentina) 9.
**Cause:** `select_dimensions` preferred totals only inside groups duplicated
on (country, year, series); a lone URBAN row passed through as the national
value. R1 could not see it because there was no duplicate.
**Rule:** R11 blocks a scored row whose dimension holds a non-total value when
that series reports the total in that dimension anywhere.
**Fix:** the total preference is now series-level in
`src/calculating/dimensions.py`: if a series has the total in a dimension
anywhere, only total or blank rows are kept. Series that never carry the total
(female-only series such as maternal mortality, anaemia, contraception and
adolescent births) are untouched. Tests in `tests/calculating/test_dimensions.py`.

## DQ-12 Legacy country code drops a series at publish

**Seen:** Andorra published with no state capacity values 1996 to 2024.
**Evidence:** the WGI workbook codes Andorra as ADO; `wb_wgi_clean.csv` carried
182 ADO rows, scored under ADO, then dropped at publish because the canonical
list has AND.
**Cause:** `resolve()` accepted any three-letter code as ISO3. R8 checks the
shape only, so a retired code travelled silently to the publisher.
**Fix:** `_LEGACY_ISO3` in `src/utils/country_identity.py` (ADO to AND, ROM to
ROU, TMP to TLS, ZAR to COD, KSV to XKX), applied in `resolve()` and in the WGI
cleaner. Tests in `tests/clean/test_country_identity_aliases.py`.

## DQ-13 Survey-year pattern silently dropped an MPI wave

**Seen:** Senegal MPI shows 2017, 2019 and 2023; the source has a fourth wave
labelled `2010-11 D`.
**Evidence:** `mpi__gMPI_Table2.csv` has 244 year labels; the cleaner kept 243.
**Cause:** `_SURVEY_YEAR_RE` in `src/clean/undp_hdr_clean.py` accepted only
`YYYY` and `YYYY/YYYY`, and rejected labels were dropped without a log line.
The end-year helper would also have returned 2010 instead of 2011.
**Rule:** none in data, since the row never enters the pipeline. The cleaner
now logs every rejected label, so a new format is visible in the run log.
**Fix:** hyphenated windows accepted, two-digit end years expanded (2010-11 to
2011, 1999-00 to 2000). Tests in `tests/clean/test_undp_hdr_survey_year.py`.

## DQ-14 Macro security index scored from a partial debt-risk input

**Seen:** mspi published for 15 country-years where a debt input is missing:
Nigeria 1996 to 2007 (9), Ethiopia 2023 to 2024, Eritrea 1996, Lebanon, Bhutan
and Tonga 2024.
**Evidence:** 14 rows have neither GNI-based debt stock series, so
`debt_basis` is null; Eritrea 1996 lacks debt service.
**Cause:** `norm_debt_risk` in `src/calculating/mspi.py` takes the maximum over
whichever ratios exist. Dropping a term from a maximum can only lower it, so
missing data biases debt risk toward Low. `docs/spec-macrosec-index.md` does
not say what to do with a missing ratio.
**Rule:** R12 once decided: block an mspi row with null `debt_basis` or an
incomplete ratio set.
**Status:** decision for the reviewer. Recommended: require all three ratios and
publish null otherwise, matching the spec's own `partial_scores: false`
principle. Write the choice into the spec first.

