# World Bank audit findings (popdens, state, mspi)

Country metadata: 296 rows, 79 aggregates, 217 countries.

## Row counts

| indicator | emitted |
|---|---|
| mspi | 2773 |
| popdens | 7311 |
| state | 5168 |

## popdens (EN.POP.DNST)

Formula (yaml, same bands in factory DensityScorer, no disagreement): need = 100 if v>=250; 75 if >=100; 50 if >=75; 25 if >=25; else 0. expected_score = 100 - need.

Records 9310; null value 335; aggregate rows dropped 1632; duplicate country-year dropped 0; emitted 7311.
Band edges are inclusive at the lower bound, matching yaml text. Yaml header says '31 reporting, only missing Palestine' which does not describe this fetch (all years, ~200 countries); stale text.

## state (WGI Government Effectiveness)

Yaml and SCORING_AUDIT row 24 say: use the pre-normalised 0-100 `Governance score (0-100)` column from the ge sheet, SimpleDirectional. factory WGI_GOVEFF is SimpleDirectionalScorer. No ambiguity on column choice: score (percentile rank) column, NOT the estimate. expected_score = value.

ge sheet rows 5340; null score 0; non-country codes dropped 172 (AIA, ANT, COK, GUF, JEY, MTQ, NIU, REU, TWN); duplicate iso3-year 0; emitted 5168.
WGI legacy code remaps applied: {'ADO': 'AND', 'ROM': 'ROU', 'TMP': 'TLS', 'ZAR': 'COD', 'KSV': 'XKX'}. Remapped codes only count if the target is in WB metadata countries.

## mspi (composite)

Implemented per docs/spec-macrosec-index.md: income = clip((ln gdp - ln200)/(ln150000-ln200)); fragility = clip((mean of available WGI EST + 2.5)/5); debt tier cutoffs -0.20/-0.80; LIC-DSF thresholds weak 30/140/10, medium 40/180/15, strong 55/240/21; max ratio bins 0.75/1.0; score map 1/0.5/0; nonconcessional = 1 - clip((100-conc)/100) (= conc/100); composite = 100 * mean of four. expected_score = composite (spec is higher_is_better; pipeline inverts then publish re-inverts).
Same-year alignment for all inputs (no carry-forward; spec silent). Scope gate: lendingType in IBD/IDB/IDX from WB metadata (current-state). The high-income refinement is NOT applied.

Choices made where spec is ambiguous (all conservative, drop rather than guess):
- PV used only if both PV GN and PV EX present; face value only if both PV absent and both face present; exactly one PV present is dropped.
- Debt service missing: dropped (max over a partial ratio set would silently understate risk).
- WGI average uses any 1 to 6 available dimensions as the spec says 'skip missing, average present'; min count not specified. n_dims in diag csv; see distribution below.
- Income <= 0 treated as missing (log undefined); none expected.
- Spec 'index_version 1.0' vs yaml 1.1: cosmetic, no formula difference found.

WGI dimensions available among emitted mspi rows: 2 dims: 1, 3 dims: 11, 4 dims: 10, 5 dims: 3, 6 dims: 2748
Debt basis: face_value: 2670, present_value: 103
Category: High: 1777, Low: 612, Moderate: 384

Drops (distinct country-years; only years where at least one mspi input existed):

| reason | country-years | countries |
|---|---|---|
| out_of_scope lendingType='LNX' (spec scope gate) | 2277 | 70 |
| incomplete_data: fragility | 802 | 103 |
| incomplete_data: debt_risk(no debt service),debt_risk(no debt stock pair),nonconcessional | 652 | 30 |
| incomplete_data: debt_risk(no debt service),debt_risk(no debt stock pair),fragility,nonconcessional | 289 | 47 |
| incomplete_data: debt_risk(no debt service),debt_risk(no debt stock pair) | 218 | 37 |
| incomplete_data: debt_risk(no debt service),debt_risk(no debt stock pair),fragility | 152 | 37 |
| incomplete_data: debt_risk(no debt stock pair),nonconcessional | 52 | 2 |
| incomplete_data: debt_risk(no debt service),debt_risk(no debt stock pair),income | 26 | 4 |
| incomplete_data: debt_risk(no debt stock pair),fragility,nonconcessional | 14 | 2 |
| incomplete_data: debt_risk(no debt service),debt_risk(no debt stock pair),fragility,income | 14 | 2 |
| incomplete_data: debt_risk(no debt service),debt_risk(no debt stock pair),income,nonconcessional | 11 | 2 |
| ambiguous: exactly one PV series present (spec silent on partial PV) | 11 | 11 |
| incomplete_data: debt_risk(no debt stock pair) | 10 | 2 |
| incomplete_data: debt_risk(no debt stock pair),fragility | 9 | 1 |
| incomplete_data: debt_risk(no debt stock pair),income | 4 | 1 |
| incomplete_data: debt_risk(no debt service),fragility | 1 | 1 |
| incomplete_data: debt_risk(no debt service) | 1 | 1 |
| incomplete_data: debt_risk(no debt stock pair),fragility,income | 1 | 1 |

Out-of-scope countries that had at least one mspi input (count 70): ABW AND ARE ASM AUS AUT BEL BHR BHS BMU BRN CAN CHE CHI CUB CUW CYM CYP CZE DEU DNK ESP EST FIN FRA FRO GBR GRC GRL GUM HKG HUN IMN IRL ISL ISR ITA JPN KOR KWT LIE LTU LUX LVA MAC MAF MCO MLT MNP NCL NLD NOR NZL OMN PRI PRK PRT PSE PYF QAT SAU SGP SMR SVK SVN SWE SXM TCA USA VIR

## Data oddities

- NY.GDP.PCAP.CD: kept 7215, min 23, max 2.88e+05, stats {'raw': 9310, 'null': 415, 'aggregate_rows_dropped': 1680, 'dup_dropped': 0, 'kept': 7215}
- DT.DOD.ALLC.ZS: kept 4022, min 0, max 100, stats {'raw': 4690, 'null': 178, 'aggregate_rows_dropped': 490, 'dup_dropped': 0, 'kept': 4022}
- DT.DOD.PVLX.GN.ZS: kept 110, min 0.0493, max 69.1, stats {'raw': 9310, 'null': 9200, 'aggregate_rows_dropped': 0, 'dup_dropped': 0, 'kept': 110}
- DT.TDS.DECT.EX.ZS: kept 3669, min 0.00349, max 157, stats {'raw': 9310, 'null': 5257, 'aggregate_rows_dropped': 384, 'dup_dropped': 0, 'kept': 3669}
- DT.DOD.ALLC.ZS outside [0,100]: 0

## Out of scope

**Out of scope** (not in indicators/country_codes.csv, not emitted): 80 codes, 32 rows. Real economies (1): CHI (Channel Islands). Aggregates / former / non-specified areas: 79. Aggregate count here is the World Bank metadata aggregates (dropped before scoring); the codes listed above are non-aggregate economies that were scored by the audit and then removed by the scope filter. Rows removed by indicator: popdens 32.
