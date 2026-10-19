# SDG non-health audit findings

Raw store: data/store/20261015T001106Z (unsdg, worldbank). Scoring mode clamp. expected_score = round(100 - need, 1), need clipped to [0,100].

## Per indicator

| key | series | formula | constant | constant source | raw | after dims | null value | non-country dropped | emitted | conflict drops | identical dups collapsed | need=0 rows |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| food | AG_PRD_FIESMS | need=0 if v<=t else 100*(1-t/v) | 20.0 | yaml (IPC threshold 20%); factory 20.0 agrees | 5380 | 1800 | 520 | 0 rows / 0 codes | 1280 | 0 | 0 | 619 |
| susag | AG_LND_SUST | need=100-v (score=v) | None | SCORING_AUDIT + factory (SimpleDirectional); yaml text says 1-5 band, disagrees | 50 | 50 | 30 | 0 rows / 0 codes | 20 | 0 | 0 | 4 |
| agoda | DC_TOF_AGRL | share=value*1e6/GDP; need=max(0,100*(1-share/0.02)) | 0.02 | yaml (goal 2% of GDP); factory 0.02 agrees | 3618 | 3618 | 0 | 145 rows / 9 codes | 3413 | 0 | 0 | 158 |
| water | SH_H2O_SAFE | gap=100-v; need=0 if gap<=b else 100*(1-b/gap) | 27.1 | yaml 27.1; factory agrees | 8726 | 3991 | 0 | 275 rows / 12 codes | 3716 | 0 | 0 | 1950 |
| sanit | SH_SAN_SAFE | gap=100-v; need=0 if gap<=b else 100*(1-b/gap) | 43.0 | yaml 43; factory agrees | 9198 | 3667 | 0 | 98 rows / 4 codes | 3569 | 0 | 0 | 1538 |
| washmort | SH_STA_WASHARI | need=0 if v<=t else 100*(1-t/v) | 10.0 | yaml 10; factory agrees | 183 | 183 | 0 | 0 rows / 0 codes | 183 | 0 | 0 | 111 |
| elec | EG_ACS_ELEC | gap=100-v; need=0 if gap<=b else 100*(1-b/gap) | 9.8 | yaml 9.8; factory agrees | 16350 | 5450 | 50 | 75 rows / 3 codes | 5325 | 0 | 0 | 3489 |
| clean | EG_EGY_CLEAN | gap=100-v; need=0 if gap<=b else 100*(1-b/gap) | 30.4 | yaml 30.4; factory agrees | 14550 | 4850 | 0 | 50 rows / 2 codes | 4800 | 0 | 0 | 2758 |
| renew | EG_FEC_RNEW | gain=0 if v<c else 1-c/v; need=100-100*gain/max(gain) | 20.0 | framework 2026-10-16: goal 20%; factory agrees | 7943 | 7943 | 246 | 506 rows / 18 codes | 7191 | 0 | 0 | 1 |
| finc | FB_BNK_ACCSS | gap=100-v; need=0 if gap<=b else 100*(1-b/gap) | 45.0 | yaml 45; factory agrees | 6648 | 711 | 0 | 10 rows / 2 codes | 701 | 0 | 0 | 379 |
| pov | SI_POV_NAHC | need=0 if v<=t else 100*(1-t/v) | 10.0 | yaml 10; factory agrees | 1156 | 1147 | 0 | 0 rows / 0 codes | 1147 | 0 | 0 | 114 |

Dimension filters applied (blank also accepted): Location=ALLAREA, Sex=BOTHSEX, Quantile=_T, Age=ALLAGE, Education level=_T; finc overrides Age=15+.

## Dimension columns with more than one value in the raw series

- food (AG_PRD_FIESMS): {'Sex': {'BOTHSEX': 1800, 'MALE': 1790, 'FEMALE': 1790}, 'Age': {'15+': 3580, 'ALLAGE': 1800}, 'attributes.Nature': {'E': 3708, '<blank>': 1546, 'CA': 126}}
- susag (AG_LND_SUST): {'attributes.Nature': {'<blank>': 30, 'C': 20}}
- agoda (DC_TOF_AGRL): none
- water (SH_H2O_SAFE): {'Location': {'ALLAREA': 3991, 'URBAN': 2610, 'RURAL': 2125}}
- sanit (SH_SAN_SAFE): {'Location': {'ALLAREA': 3667, 'URBAN': 3067, 'RURAL': 2464}}
- washmort (SH_STA_WASHARI): none
- elec (EG_ACS_ELEC): {'Location': {'ALLAREA': 5450, 'RURAL': 5450, 'URBAN': 5450}, 'attributes.Nature': {'M': 8527, 'E': 4889, 'C': 2349, '<blank>': 585}}
- clean (EG_EGY_CLEAN): {'Location': {'ALLAREA': 4850, 'URBAN': 4850, 'RURAL': 4850}}
- renew (EG_FEC_RNEW): {'attributes.Nature': {'E': 7697, '<blank>': 246}}
- finc (FB_BNK_ACCSS): {'Location': {'ALLAREA': 6371, 'URBAN': 139, 'RURAL': 138}, 'Sex': {'BOTHSEX': 5226, 'FEMALE': 711, 'MALE': 711}, 'Quantile': {'_T': 5252, 'B40': 698, 'R60': 698}, 'Age': {'15+': 5226, '25+': 711, '15-24': 711}, 'Education level': {'_T': 5228, 'AGG_GE2': 710, 'AGG_0_1': 710}}
- pov (SI_POV_NAHC): {'Location': {'ALLAREA': 1147, 'URBAN': 9}}

Reading: food keeps Age=ALLAGE/BOTHSEX (the 15+ rows are sex-split only and fall out). water, sanit, elec, clean keep ALLAREA (URBAN/RURAL dropped). pov keeps ALLAREA (9 URBAN rows dropped). finc keeps Age 15+, BOTHSEX, ALLAREA, _T, _T. Nature, Reporting Type, Units varied only as shown; after the total filters no country-year had conflicting values unless listed in the conflict column and sdg_other_diag.csv.

## agoda normalization

- SDG series DC_TOF_AGRL, Units column CON_USD_M (millions of constant 2022 USD). Multiplied by 1e6 to get USD.
- GDP: worldbank NY.GDP.MKTP.CD (current USD), joined on iso3 and same year. share = value*1e6/GDP.
- Goal ratio per yaml: need = 100*(1 - share/0.02); better than goal (share >= 2%) -> need 0 (clamp). SCORING_AUDIT: GoalRatioScorer compares value/goal.
- Dropped for missing or non-positive GDP: 60. Negative raw flows: 1 (need would exceed 100, clipped to 100, score 0; listed in diag csv).
- Ambiguity: numerator is constant 2022 USD, denominator is current USD. Spec says only 'normalized to country GDP'; mixed price bases not adjusted here.

## susag scale

- Raw values range 11.0 to 100.0 (Units PERCENT), so the series is a 0-100 proportion, not the 1-5 band the yaml describes.
- Disagreement: yaml scoring text for susag (inverse of score squared, optimum 5 = 0.04) is for a 1-5 band. factory.py and SCORING_AUDIT use SimpleDirectional (100 - value). This script follows factory/SCORING_AUDIT because the raw scale is 0-100; the yaml text is stale. Only 20 country-years exist (10 countries, years 2020-2024 only; 30 of 50 raw rows have null value).

## Other observations

- All series use geoAreaCode mapped via indicators/country_codes.csv (numeric M49 to ISO3); codes not in it are regions/aggregates or unmapped territories and are counted above in the non-country column.
- yaml vs factory constants: no numeric disagreement; only the susag scoring text noted above.
- yaml scoring text for every ratio/inverse indicator also says values better than the 'global average' are harmonized to 0, which is the clamp rule used here.
- washmort max raw is 108.06 per 100,000 and pov min 0.0 (need 0, score 100).

## Out of scope

**Out of scope** (not in indicators/country_codes.csv, not emitted): 20 codes, 1159 rows. Real economies (19): 175 (Mayotte), 184 (Cook Islands), 238 (Falkland Islands (Malvinas)), 254 (French Guiana), 312 (Guadeloupe), 412 (Kosovo), 474 (Martinique), 500 (Montserrat), 535 (Bonaire, Sint Eustatius and Saba), 570 (Niue), 638 (Réunion), 652 (Saint Barthélemy), 654 (Saint Helena), 660 (Anguilla), 666 (Saint Pierre and Miquelon), 772 (Tokelau), 831 (Guernsey), 832 (Jersey), 876 (Wallis and Futuna Islands). Aggregates / former / non-specified areas: 1.
