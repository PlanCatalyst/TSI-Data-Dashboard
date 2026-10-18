# Root cause: extra_in_dashboard (102 rows)

Scope: `audit/results/mismatches.csv`, class `extra_in_dashboard`. Traced from
`dashboard/public/v1/timeseries.json` back through
`data/interim/validated/indicatorscores/<key>.csv` and `data/clean/` to the raw
store `data/store/20261015T001106Z/`. Nothing was run or changed.

| Group | Rows | Verdict | Cause in one line |
|---|---:|---|---|
| agoda | 35 | pipeline wrong | no GDP for the year, so raw USD millions are scored as if they were an ag-flow/GDP ratio, giving need 0 and a published 100 |
| sanit | 31 | pipeline wrong | only an URBAN row exists for the country-year; the publisher takes it as the national value |
| water | 21 | pipeline wrong | same as sanit |
| mspi | 15 | spec ambiguous (audit stricter) | debt-risk component is built from a partial set of ratios; the spec does not say what to do |

## 1. agoda (35 rows: CUB 4, ERI 13, SSD 9, SYR 2, TCA 1, YEM 6)

**Root cause.** The pipeline gets its denominator from `NY.GDP.MKTP.CD` in
`data/clean/world-bank/world_bank_clean.csv`, joined on country and year
(`src/calculating/pipeline.py:56-69`). The World Bank GDP series ends early for
these countries, so the left join leaves `_gdp` NaN. The `valid` mask
(`pipeline.py:70-74`) then skips the row, and the line that writes back
(`pipeline.py:80`) keeps the original unconverted value. The row stays in the
frame in raw millions of constant 2022 USD, and `GoalRatioScorer(goal=0.02)`
(`src/calculating/factory.py:36`) reads it as a ratio. 27.1 against a goal of
0.02 is far past the goal, need clamps to 0, and the publish boundary flips it
to 100.

**Evidence.**
- GDP coverage in `world_bank_clean.csv` (non-null): CUB 1990-2020, ERI 1992-2011,
  SSD 2008-2015, SYR 1990-2022, TCA 2001-2024, YEM 1990-2018. The extra rows are
  exactly the years outside these windows (CUB 2021-24, ERI 2012-24, SSD 2016-24,
  SYR 2023-24, YEM 2019-24, TCA 2000).
- `indicatorscores/agoda.csv`, CUB: 2020 value 0.000351 (a ratio, score 98.2),
  2021 value 27.105328 (raw USD millions, score 0.000000). The audit diag
  `audit/findings/sdg_other_diag.csv` lists the same value 27.105328 as
  `no_gdp_dropped`.
- Mixed-scale values in one series is the signature: ratios near 1e-4 next to
  values in the tens.

**Verdict.** Pipeline wrong. Audit correct to drop these rows
(`audit/findings/sdg_other.md`, "agoda normalization": 60 dropped for missing GDP).
The docstring at `pipeline.py:48-51` states the intent (convert to a ratio);
the unconverted fall-through breaks it.

**Proposed fix (pipeline).** In `_apply_agoda_gdp_normalization`, set `value` to
NaN where `valid` is false instead of leaving it, so a country-year with no
denominator publishes `null`. One extra line after the `if valid.any()` block
(or make the assignment unconditional). Also drop the early `return df` when
`gdp.empty` at `pipeline.py:62-63`, which has the same fall-through. Open decision:
whether to fall back to another GDP source for CUB 2021-24 and
SYR/YEM recent years; that is a separate data choice, not part of this fix.

**DQ draft.**

| ID | Symptom | Rule | Status |
|----|---------|------|--------|
| DQ-NEW-1 | Agricultural aid flows show 100 (best) for 35 country-years (Eritrea 2012-24, South Sudan 2016-24, Yemen 2019-24, Cuba 2021-24, Syria 2023-24, Turks & Caicos 2000) | proposed R10 block (unit sanity: post-normalisation `DC_TOF_AGRL` value must be <= 1, a ratio above 100% of GDP is a unit error). R2 cannot catch it because the score is in range and a source value exists | open |

Section text: **Seen:** ag flow score 100 where GDP is unavailable. **Evidence:**
`indicatorscores/agoda.csv` holds raw USD millions (27.1) beside ratios (0.0004).
**Cause:** `_apply_agoda_gdp_normalization` leaves unconverted values in place
when the GDP join misses. **Fix:** null them.

## 2. sanit (31 rows) and 3. water (21 rows)

Rows: sanit ARG 2017-24 (8), BIH 2019-24 (6), GNB 2000-01 (2), KHM 2000-01 (2),
SAU 2000-12 (13); water TCA 2000-15 (16), USA 2000-04 (5).

**Root cause.** For these country-years the UN SDG API returns only
`Location = URBAN` for `SH_SAN_SAFE` (6.2.1) and `SH_H2O_SAFE` (6.1.1). There is
no ALLAREA row. `select_dimensions` only looks for a total inside groups that
are duplicated on the key (`src/calculating/dimensions.py:81-90`); a group with
one row passes through untouched (`dimensions.py:82`, `pieces = [sdf[~dup]]`).
The single URBAN row therefore reaches the scorer as the national value.
`_prefer_total` (`dimensions.py:53-57`) also falls back to all rows when the
total is absent, by design.

**Evidence.**
- Raw store `unsdg/records.csv`: SH_SAN_SAFE geoAreaCode 32 (ARG) 2017: one row,
  Location URBAN, 48.38; SAU 2000: URBAN 87.26; BIH 2019-21: URBAN 50.7-58.1;
  GNB, KHM 2000-01: URBAN only. SH_H2O_SAFE TCA 2000-02: URBAN 46.54; USA
  2000-01: URBAN 96.45. No other Location value for those keys.
- `indicatorscores/sanit.csv` and `water.csv` carry `location = URBAN` with those
  exact values, scored (ARG 2017 score 16.70, published 83.3; SAU 2000 score 0.0,
  published 100; USA 2000 score 0.0, published 100).
- The audit script keeps only ALLAREA and emits nothing for these keys
  (`audit/findings/sdg_other.md`: "water, sanit, elec, clean keep ALLAREA").

**Verdict.** Pipeline wrong. An urban-only access rate overstates national
coverage, which is why SAU and USA hit 100 and ARG shows 83 where the national
figure would be lower. The audit follows the dimension rule in the common rules
and DQ-02's own stated intent ("generic totals").

**Proposed fix (pipeline).** In `dimensions.py`, apply the total filter to every
row, not only duplicated groups: for each column in `_GENERIC_TOTALS`, if the
column is present and the series has any total in that column at all, drop rows
whose value is a non-total (URBAN, RURAL, FEMALE, MALE, quantiles, and so on)
unless the group has no total, in which case drop the group and log it. Keep
blank dimension values. Add a test next to `tests/calculating/test_dimensions.py`
with a lone URBAN row expecting no output. Run a scan across all SDG series for
other lone non-total rows; `pov` has 9 URBAN rows per the audit and `elec`,
`clean`, `finc` should be checked the same way, though they produced no extras
in this run.

**DQ draft.**

| ID | Symptom | Rule | Status |
|----|---------|------|--------|
| DQ-NEW-2 | Safe water and sanitation scores built from urban-only data (52 country-years: Saudi Arabia 2000-12, Argentina 2017-24, Turks & Caicos 2000-15, USA 2000-04, others) | proposed R11 block (every published SDG row must have each dimension in {total, blank}; a row with `location` in URBAN or RURAL fails). R1 cannot catch it because no duplicate exists | open |

Section text: **Seen:** national water and sanitation scores that are really
urban values. **Evidence:** `indicatorscores/sanit.csv` rows with
`location = URBAN`. **Cause:** `select_dimensions` only prefers totals inside
duplicated groups. **Fix:** filter non-totals on every row.

## 4. mspi (15 rows)

Rows: NGA 1996, 1998, 2000, 2002-2007 (9); ERI 1996; ETH 2023-24; LBN 2024;
BTN 2024; TON 2024.

**Root cause.** The debt-risk component takes the worst available ratio over
`r_gni`, `r_exp`, `r_ds` with `skipna=True` (`src/calculating/mspi.py:147`), so
it scores a country on whichever ratios happen to exist. The audit
requires the full set and drops otherwise (`audit/findings/worldbank.md`:
"Debt service missing: dropped", "exactly one PV present is dropped").

Two sub-cases, both traced to the raw store `worldbank/records.csv`:

- **14 rows, GNI-based debt stock missing** (NGA 9, ETH 2, LBN, BTN, TON 2024). Both
  `DT.DOD.PVLX.GN.ZS` and `DT.DOD.DECT.GN.ZS` are null, so `debt_stock_basis`
  (`mspi.py:123-134`) finds neither pair complete, returns NaN for both stock
  values and a null `debt_basis`. `norm_debt_risk` then reduces to debt service
  alone (NGA also has `DECT.EX` present, but it is discarded because the pair is
  incomplete). Example NGA 2007: DECT.EX 27.81, DS 2.37, no GN series, published
  mspi 43.3. `indicatorscores/mspi.csv` shows `debt_basis` null on exactly these
  14 rows (14 of 2788 null in the file).
- **1 row, debt service missing** (ERI 1996): DECT.GN 6.46 and DECT.EX 20.99
  present, `DT.TDS.DECT.EX.ZS` null. `debt_basis = face_value`, `r_ds` skipped
  (`mspi.py:146-147`), score computed from two ratios.

**Verdict.** Spec ambiguous; pipeline permissive, audit conservative. The spec
(`docs/spec-macrosec-index.md` step 3-6) defines `max(r_gdp, r_exp, r_ds)` with no
rule for a missing term, and "Skip missing" appears only for WGI averaging. The
spec's own principle for components ("partial_scores: false", lines 228-231) is
that a partial composite is systematically biased. Dropping a ratio from a max
can only lower max_ratio, so the pipeline's choice biases debt risk toward Low
(better score). A null `debt_basis` on a published score also contradicts the
spec requirement to record the basis used.

**Proposed fix.** Not a bug to patch silently; needs a decision. Recommended: require all three ratios (stock
pair plus debt service) in `norm_debt_risk`, returning NaN otherwise, which
makes these 15 country-years `incomplete_data` like the other gaps, and match the
audit's rule on a lone PV series. If permissive handling is preferred, change the
audit script to skip-missing instead and document it in the spec. Either way,
write the choice into the spec first (contract-affecting for scored vs null).

**DQ draft.**

| ID | Symptom | Rule | Status |
|----|---------|------|--------|
| DQ-NEW-3 | MSPI scored from a partial debt-risk input (15 country-years: Nigeria 1996-2007, Ethiopia 2023-24, Eritrea 1996, Lebanon, Bhutan, Tonga 2024) | proposed R12 block once decided, warn until then (an mspi row with null `debt_basis`, or whose debt-risk ratio set is not complete). Value-based rules cannot see it: the score is in range and every other component is real | decision |

Section text: **Seen:** mspi published where a debt input is missing. **Evidence:**
`indicatorscores/mspi.csv` null `debt_basis` on 14 rows; raw store has no
`DT.DOD.*.GN.ZS` for them. **Cause:** `norm_debt_risk` takes max over available
ratios. **Fix:** pending decision on partial inputs.

## Files cited

`src/calculating/pipeline.py`, `src/calculating/dimensions.py`,
`src/calculating/mspi.py`, `src/calculating/factory.py`,
`audit/findings/sdg_other.md`, `audit/findings/sdg_other_diag.csv`,
`audit/findings/worldbank.md`, `docs/spec-macrosec-index.md`.
