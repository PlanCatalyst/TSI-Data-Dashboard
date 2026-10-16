# SDG health audit findings

Raw: data/store/20261015T001106Z/unsdg/records.csv. Mode: clamp. Script: audit/derive_sdg_health.py.

## Formulas and counts

| key | series | formula | constant (source) | raw | non-numeric | after dims | after ISO3 | emitted | conflict drops | years | countries |
|---|---|---|---|---|---|---|---|---|---|---|---|
| uhc | SH_ACS_UNHC_25 | need = 100 - v (score = v) | none (yaml: 100 - index) | 4680 | 0 | 4680 | 4632 | 4632 | 0 | 2000-2023 | 193 |
| tb | SH_TBS_INCD | need = 0 if v <= t else 100*(1-t/v) | 40.0 (yaml text and factory agree) | 5347 | 25 | 5322 | 5157 | 5157 | 0 | 2000-2024 | 208 |
| mal | SH_STA_MALR | need = 0 if v <= t else 100*(1-t/v) | 10.0 (yaml text and factory agree) | 2725 | 0 | 2725 | 2675 | 2675 | 0 | 2000-2024 | 107 |
| mmr | SH_STA_MORT | need = 0 if v <= t else 100*(1-t/v) | 70.0 (yaml text and factory agree) | 4680 | 0 | 4680 | 4656 | 4656 | 0 | 2000-2023 | 194 |
| u5mr | SH_DYN_MORT | need = 0 if v <= t else 100*(1-t/v) | 25.0 (yaml text and factory agree) | 15000 | 0 | 5000 | 4875 | 4875 | 0 | 2000-2024 | 195 |
| stunt | SH_STA_STNT | need = 0 if v <= t else 100*(1-t/v) | 12.0 (yaml text and factory agree) | 12150 | 0 | 4050 | 4050 | 4050 | 0 | 2000-2024 | 162 |
| maln | SN_STA_OVWGT | need = 0 if v <= t else 100*(1-t/v) | 2.5 (yaml text and factory agree) | 12225 | 0 | 4075 | 4075 | 4075 | 0 | 2000-2024 | 163 |
| anaem | SH_STA_ANEM | need = 0 if v <= t else 100*(1-t/v) | 25.0 (yaml text and factory agree) | 4656 | 0 | 4656 | 4608 | 4608 | 0 | 2000-2023 | 192 |
| contra | SH_FPL_MTMM | gap=100-v; need = 0 if gap <= b else 100*(1-b/gap) | 11.5 (yaml text and factory agree) | 482 | 0 | 482 | 480 | 480 | 0 | 2000-2023 | 142 |
| abr | SP_DYN_ADKL | need = 0 if v <= t else 100*(1-t/v) | 20.0 (yaml text and factory agree) | 7289 | 0 | 3784 | 3541 | 3541 | 0 | 2000-2023 | 212 |
| ihr | SH_IHR_CAPS | need = 100 - v (score = v) | none (yaml: 100 - index) | 15041 | 0 | 15041 | 14924 | 1148 | 0 | 2010-2017 | 193 |

## Dimension columns with more than one value, and handling

- uhc (SH_ACS_UNHC_25): none
- tb (SH_TBS_INCD): none
- mal (SH_STA_MALR): attributes.Nature=['C', 'CA', 'E', 'M']
- mmr (SH_STA_MORT): none. Sex only ['FEMALE'] (no total; accepted as sole value)
- u5mr (SH_DYN_MORT): Sex=['BOTHSEX', 'FEMALE', 'MALE']. Age only ['<5Y'] (no total; accepted as sole value)
- stunt (SH_STA_STNT): Sex=['BOTHSEX', 'FEMALE', 'MALE']. Age only ['<5Y'] (no total; accepted as sole value)
- maln (SN_STA_OVWGT): Sex=['BOTHSEX', 'FEMALE', 'MALE']. Age only ['<5Y'] (no total; accepted as sole value)
- anaem (SH_STA_ANEM): none. Sex only ['FEMALE'] (no total; accepted as sole value) Age only ['15-49'] (no total; accepted as sole value)
- contra (SH_FPL_MTMM): none. Sex only ['FEMALE'] (no total; accepted as sole value) Age only ['15-49'] (no total; accepted as sole value)
- abr (SP_DYN_ADKL): attributes.Nature=['C', 'CA']; Age=['10-14', '15-19']. Sex only ['FEMALE'] (no total; accepted as sole value) Age only ['10-14', '15-19'] (no total; accepted as sole value)
- ihr (SH_IHR_CAPS): IHR Capacity=['IHR01', 'IHR02', 'IHR03', 'IHR04', 'IHR05', 'IHR06', 'IHR07', 'IHR08', 'IHR09', 'IHR10', 'IHR11', 'IHR12', 'IHR13']. country-years with <13 capacities: 0

## Dropped non-country geographies (aggregates/regions, unmapped to ISO3)

| key | rows dropped | distinct codes |
|---|---|---|
| uhc | 48 | 2 |
| tb | 165 | 8 |
| mal | 50 | 2 |
| mmr | 24 | 1 |
| u5mr | 125 | 5 |
| stunt | 0 | 0 |
| maln | 0 | 0 |
| anaem | 48 | 2 |
| contra | 2 | 1 |
| abr | 243 | 18 |
| ihr | 117 | 3 |

Unmapped codes and names (union):

158 Other non-specified areas in Eastern Asia, 175 Mayotte, 184 Cook Islands, 254 French Guiana, 312 Guadeloupe, 336 Holy See, 412 Kosovo, 474 Martinique, 500 Montserrat, 530 Netherlands Antilles  [former], 535 Bonaire, Sint Eustatius and Saba, 570 Niue, 638 Réunion, 652 Saint Barthélemy, 660 Anguilla, 666 Saint Pierre and Miquelon, 772 Tokelau, 831 Guernsey, 832 Jersey, 876 Wallis and Futuna Islands, 891 Serbia and Montenegro [former]

## Out of scope

**Out of scope** (not in indicators/country_codes.csv, not emitted): 21 codes, 822 rows. Real economies (18): 175 (Mayotte), 184 (Cook Islands), 254 (French Guiana), 312 (Guadeloupe), 336 (Holy See), 412 (Kosovo), 474 (Martinique), 500 (Montserrat), 535 (Bonaire, Sint Eustatius and Saba), 570 (Niue), 638 (Réunion), 652 (Saint Barthélemy), 660 (Anguilla), 666 (Saint Pierre and Miquelon), 772 (Tokelau), 831 (Guernsey), 832 (Jersey), 876 (Wallis and Futuna Islands). Aggregates / former / non-specified areas: 3.

## Conflict drops

See audit/findings/sdg_health_diag.csv. Per key: uhc=0, tb=0, mal=0, mmr=0, u5mr=0, stunt=0, maln=0, anaem=0, contra=0, abr=0, ihr=0

## Sanity

- Rows: 39897; duplicate (iso3,year,key): 0; score range 1.3 to 100.0.

## Ambiguities and observations

- yaml says values below the global average are harmonized to 0; no global average numbers are given, so the threshold/benchmark is used as the clamp point (factory sets global_average = threshold). Same result as clamp.
- contra yaml text: 100 - indicator, then 1 - 11.5/gap (the gap of unmet need), implemented as InverseRatio.
- yaml 3.2.1 u5mr definition text is a copy of skilled birth attendance; scoring text (target 25) and series SH_DYN_MORT used.
- yaml says stunt result is a continuous 0-1 scale; scored 0-100 as the other ratio indicators.
- Series with only FEMALE sex (mmr, anaem, contra, abr) have no BOTHSEX row; the sole value is used.
- uhc yaml cites no series code; SH_ACS_UNHC_25 (2025 methodology) is the only UHC series in the store.
- Nature codes differ for mal (C, CA, M, E) and tb; leftovers with identical value are collapsed, conflicts dropped.
