# Root cause: missing_in_dashboard (59 rows)

Method: read-only trace through data/clean/, data/interim/validated/, the published JSON and the cleaners/publisher. Nothing was run or edited.

| Group | Rows | Verdict |
|-------|------|---------|
| popdens CHI 1990-2021 | 32 | audit wrong (scope), spec ambiguous on whether CHI belongs |
| state AND 1996-2024 | 26 | pipeline wrong |
| mpi SEN 2010 | 1 | pipeline wrong (and the audit year is also off by one) |

## 1. popdens, CHI (Channel Islands), 32 rows

- Root cause: CHI is a World Bank economy code that is not in indicators/country_codes.csv (216 rows, no CHI; grep confirms), so the publisher skips it.
- Evidence:
  - data/clean/world-bank/world_bank_clean.csv line 12392: `CHI,Channel Islands,EN.POP.DNST,...,1990,722.66`. Fetch and clean keep it.
  - data/interim/validated/indicatorscores/popdens.csv lines 1542-1543: CHI scored (score 100.0 in pipeline orientation). Scoring keeps it.
  - src/calculating/pipeline.py:126-128: resolve() passes any 3-letter code through, so CHI survives to the pillar stage.
  - src/upload/publish_dashboard.py:345 (`if iso3 not in codes_lookup.index: continue`) and :460-462 (`valid_iso3s = pillar_scores & country_codes.iso3`) drop it. CHI is absent from countries.json and timeseries.json.
  - CHI is one of ~48 non-country codes in world_bank_clean.csv absent from country_codes.csv; the rest are aggregates. CHI is the only real economy there.
  - The CHI mismatch rows carry expected 0.0 vs nothing published; the band scoring itself is not in dispute.
- Verdict: audit wrong relative to the published country scope. The country list is country_codes.csv by design (country_identity.py docstring lines 30-31, "216-row canonical list"; it also intentionally omits GGY/JEY, the two components of CHI, which sit in _EXTRA_M49). Mild spec ambiguity: nothing in the spec says explicitly that territories without an ISO3 of their own are out of scope.
- Proposed fix: audit script. Restrict expected rows to iso3 in indicators/country_codes.csv, and list CHI (and any other WB non-canonical economy) as an "out of scope" count in findings. No pipeline change. Optional (needs a scope decision): add CHI to country_codes.csv, but then it also needs an M49/region and a TopoJSON key; the map has no polygon for it, so not recommended.
- DQ entry draft:

```
| DQ-NEW-1 | Audit expects popdens for Channel Islands (CHI, 32 country-years) that the dashboard never publishes | none (scope, not data) | open |

## DQ-NEW-1 Non-canonical economy scored but not published

**Seen:** audit reconcile reports 32 missing_in_dashboard rows, all popdens for CHI, 1990-2021.
**Evidence:** CHI is in world_bank_clean.csv and indicatorscores/popdens.csv, absent from indicators/country_codes.csv; publish_dashboard.py:345 and :460-462 filter to that list.
**Cause:** the published country scope is country_codes.csv (216). CHI is a World Bank-only code (Guernsey + Jersey). The derivation did not apply the scope filter.
**Rule:** none can catch it in data: scoring a code outside the scope list is expected and the publisher drops it silently. A warn-level rule "scored codes not in country_codes.csv" would list CHI plus aggregates and be noisy; better to fix the audit filter.
**Fix:** audit side only. Restrict derivation to country_codes.csv.
```

## 2. state (WGI Government Effectiveness), AND (Andorra), 26 rows

- Root cause: the WGI workbook still uses the legacy code ADO for Andorra. The cleaner keeps it verbatim, resolve() passes it through (it matches `^[A-Z]{3}$`), scoring emits it as ADO, and the publisher drops it because the canonical list has AND, not ADO. Andorra is published (AND is in countries.json and timeseries.json) with its other indicators, so only `state` silently goes missing: ts['AND']['state'] has no values and the ctx pillar for AND rests on fewer components.
- Evidence:
  - data/clean/world-bank/wb_wgi_clean.csv: 0 rows with AND, ADO rows from 1996 (e.g. `ADO,Andorra,1996,66.1026449`).
  - data/interim/validated/indicatorscores/state.csv lines 101-102: `ADO,Andorra,1996,66.1026449,...,33.8973551`. Scored under ADO.
  - src/clean/wb_wgi_clean.py:131 takes `raw[iso3_col]` as is; :138 only checks the shape `^[A-Z]{3}$`.
  - src/utils/country_identity.py:158 (`_ISO3_RE`) and the passthrough in resolve() (lines ~258-260) accept ADO as already ISO3. No alias for legacy codes.
  - src/upload/publish_dashboard.py:345 and :460-462 drop ADO.
  - Other WGI codes not in country_codes.csv are ANT, AIA, COK, GUF, JEY, MTQ, NIU, REU, TWN: genuinely out of scope territories. ADO is the only one with a canonical equivalent. The audit also maps ROM, TMP, ZAR, KSV (WGI_CODE_FIX, audit/derive_worldbank.py:19); none of those appear in the cleaned WGI file, so they are inert.
- Verdict: pipeline wrong. ADO is a legacy ISO 3166 code (ISO3 is AND) and the workbook is the issue; Andorra is in scope and the dashboard claims to cover it.
- Proposed fix: pipeline. Add a legacy-code alias map in src/utils/country_identity.py (single source of truth, per its docstring) applied in resolve() for ISO3 input: `{"ADO": "AND", "ROM": "ROU", "TMP": "TLS", "ZAR": "COD", "KSV": "XKX"}` where the target exists in country_codes.csv, then rerun the pipeline. Also mirror in wb_wgi_clean.py by calling resolve() on the code column so the clean CSV is already canonical. Expect AND state 1996-2024 (26 values) to appear and the AND ctx pillar and overall to change.
- DQ entry draft:

```
| DQ-NEW-2 | Andorra has no State capacity (WGI) series; its context pillar uses fewer indicators | R10 (proposed) | open |

## DQ-NEW-2 Legacy ISO3 code drops a country's series at publish

**Seen:** the published Andorra record has no `state` values 1996-2024 while the WGI workbook has them.
**Evidence:** wb_wgi_clean.csv carries `ADO`; indicatorscores/state.csv scores it; publish_dashboard.py:345 drops it because country_codes.csv has `AND`.
**Cause:** WGI uses a legacy code. resolve() treats any three-letter code as valid ISO3, and R8 only checks the shape, so the unmatched code travels silently to the publisher.
**Rule:** R10 (new, block or warn): every scored country_code must be in country_codes.csv or in an explicit out-of-scope list (ANT, AIA, COK, GUF, JEY, MTQ, NIU, REU, TWN, CHI plus aggregates). ADO would fail it. Needs the out-of-scope list to avoid noise.
**Fix:** legacy alias map in country_identity.py (ADO to AND, ROM to ROU, TMP to TLS, ZAR to COD, KSV to XKX), used by resolve().
```

## 3. mpi, SEN 2010, 1 row

- Root cause: the survey-year regex in the UNDP HDR cleaner does not accept a hyphenated window. The raw label is `2010-11 D` (the only one of the 244 labels in the sheet that is not `YYYY`, `YYYY/YYYY` plus a letter). The row is filtered out before value parsing, so the cleaned file has 243 MPI rows. That is the 243 vs 244 discrepancy in docs/source-candidates.md line 32; the audit counted all 244.
- Evidence:
  - data/store/20261015T001106Z/undp_hdr/sheets/mpi__gMPI_Table2.csv line 196: `Senegal,,2010-11 D,,0.3451753504363448,...`. A scan of the sheet found 244 year labels and exactly one failing the pipeline pattern (this row).
  - src/clean/undp_hdr_clean.py:25-27 (`_SURVEY_YEAR_RE` allows only a `/` separator) and :225 (`df[df["year_label"].apply(self._is_survey_year_string)]`) drop it silently.
  - data/clean/undp-hdr/undp_hdr_clean.csv: Senegal mpi has 2017, 2019, 2023 only; published SEN mpi has 2017, 2019, 2023 (31.2, 33.9, 39.3 per index 27, 29, 33).
- Year question (both sides are off): even with the regex fixed, `_survey_end_year` (src/clean/undp_hdr_clean.py:258-263, `findall` on 4-digit years, last match) returns 2010 for `2010-11`, and the audit does the same (audit/derive_ndgain_undp.py:151-152, `re.findall(r"\d{4}", ys)`). Both claim the rule "survey END year", for which `2010-11` should be 2011. The audit expected row (SEN 2010) therefore has the wrong year as well. Check: no other country has a Senegal-style 2-digit end year, so impact is this single row.
- Verdict: pipeline wrong (a valid wave silently dropped, yielding 243 vs 244). The audit is also wrong on the year (2010 instead of 2011).
- Proposed fix: pipeline. Extend `_SURVEY_YEAR_RE` to accept `YYYY-YY` and make `_survey_end_year` expand a two-digit end (2010-11 to 2011), then SEN gets 2011 = 25.8 in the series (expected value from audit's score is correct for the value, year shifts). Audit: apply the same end-year expansion in derive_ndgain_undp.py:151-152. Then the cleaned count is 244 and docs/source-candidates.md line 32 should read 244. Add an assertion in the cleaner: rows kept equals rows with a year label matching `^(19|20)\d{2}`; log any label that fails.
- DQ entry draft:

```
| DQ-NEW-3 | One MPI survey wave (Senegal 2010-11) never reaches the dashboard; docs say 243 waves, source has 244 | R11 (proposed) | open |

## DQ-NEW-3 Survey-year regex silently drops a wave

**Seen:** SEN MPI shows 2017, 2019, 2023; the source has a fourth wave, labelled `2010-11 D`.
**Evidence:** mpi__gMPI_Table2.csv line 196; undp_hdr_clean.py:25-27 and :225 accept only `YYYY` and `YYYY/YYYY`; cleaned file has 243 rows vs 244 labels.
**Cause:** hyphenated window not matched; the filter drops without a log line. `_survey_end_year` would also return 2010 rather than 2011.
**Rule:** R11 (new, block): source-row reconciliation for the MPI sheet, count of year-labelled rows in the raw sheet equals the cleaned row count. A generic data rule cannot see it because the dropped row never enters the pipeline; the rule needs the raw store count.
**Fix:** accept `YYYY-YY` in the regex, expand the two-digit end year, log any rejected label.
```
