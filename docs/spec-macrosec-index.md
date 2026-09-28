# Country Macro Socio-Economic Performance Index

Client indicator specification. Two revisions received:

| Revision | Received | Source file (repo root) |
|---|---|---|
| Original | 2026-09-17 | `Country Macro Socio-Economic Performance Index (1).docx` |
| **Updated (current)** | **2026-09-24** (doc mtime 2026-09-23) | `Macro_Socio-Economic_Performance_Index_Spec UPDATED.docx` |

The client kept `index_version: "1.0"` on both. **That is wrong and we do not
mirror it.** The updated revision adds a scope rule and a three-value status
field, which changes output semantics, so this document tracks
`client_doc_revision: 2026-09-23` alongside it. Ask Reyna to bump her version
string. See "Delta against the original revision" below for what actually
changed and what it costs us.

The formula, weights, bounds, series list and debt-risk logic are **byte-for-byte
unchanged** between revisions. Everything new is about which countries appear in
the output and how a null is labelled.

This composite **replaces the interim `hdi` stopgap** in the `pri / macrosec`
slot. `hdi` stays live until the composite is wired, scored, and published.

The pipeline still emits vulnerability-oriented scores (`higher = more need`).
This spec is `higher_is_better`. Invert once at scoring
(`pipeline_score = 100 - composite`) and nowhere else; the publish boundary
then restores dashboard orientation.

## Composite formula

```
Composite Index (0-100) =
    100 × ( 0.25 × norm_income
          + 0.25 × norm_fragility
          + 0.25 × norm_debt_risk
          + 0.25 × norm_nonconcessional )
```

Equal weighting, 25% per component. All components are oriented so
`higher = better` before weighting. **If any one component is null for a
country, the composite is null.**

## Normalization bounds

Fixed absolute bounds; out-of-range values clipped to `[0, 1]`. Bounds are
versioned constants. Changing them requires an index version bump and
re-baselining of the historical series.

| Component | Lower | Upper |
|---|---|---|
| Income (log) | ln(200) | ln(150,000) |
| Fragility (WGI avg) | −2.5 | +2.5 |
| Non-concessional debt | 0% | 100% |
| Debt risk | categorical (0 / 0.5 / 1.0) | — |

Refresh cadence: WGI and IDS are published annually, so roughly every other
six-month refresh will show no change in those components. Surface the
vintage year per component in the UI so flat periods are not read as stalled
progress.

## 1. Per capita income (25%)

- **Measures:** economic output per person.
- **Source:** World Bank WDI.
- **Series:** `NY.GDP.PCAP.CD` — GDP per capita, current US$.
- **Already in repo:** commented out in `src/config/settings.yaml`. Uncomment;
  do not confuse with `NY.GDP.MKTP.CD` (total GDP, used only to normalize
  `agoda`).

```
norm_income = clip( (ln(gdp_pc) - ln(200)) / (ln(150000) - ln(200)), 0, 1 )
```

## 2. Vulnerability & fragility (25%)

- **Measures:** institutional quality, governance strength, political stability.
- **Source:** World Bank Worldwide Governance Indicators (WGI).
- **Series:** average of `VA.EST`, `PV.EST`, `GE.EST`, `RQ.EST`, `RL.EST`,
  `CC.EST` (each approx. −2.5 to +2.5, higher = better). Skip missing
  dimensions, then average what is present.
- **Do not reuse `WGI_GOVEFF`.** That series is the 0–100 percentile column
  from the `ge` sheet only, used by `state`. This component needs the **EST
  estimate** on the native −2.5 to +2.5 scale, across all six dimensions.
  The existing WGI XLSX already contains those sheets.

```
avg_wgi = mean(available dimension scores)   # skip missing dimensions
norm_fragility = clip( (avg_wgi + 2.5) / 5.0, 0, 1 )
```

`avg_wgi` is reused by component 3 for debt-capacity tiering — compute once.

If fetching via the WB API instead of the XLSX, `source=3` is required. Do
not mix source 3 codes with source 75 prefixed codes (`GOV_WGI_PV.EST` etc.).

## 3. Risk of debt distress, proxy (25%)

Mechanical approximation of the IMF / World Bank LIC-DSF rating
(Low / Moderate / High) from external debt burden ratios. CPIA is replaced
by `avg_wgi` because CPIA covers only IDA-eligible countries.

**Preferred (present value):** `DT.DOD.PVLX.GN.ZS` (% GNI),
`DT.DOD.PVLX.EX.ZS` (% exports).
**Fallback (face value):** `DT.DOD.DECT.GN.ZS`, `DT.DOD.DECT.EX.ZS`.
**Debt service:** `DT.TDS.DECT.EX.ZS` (% exports).

Record which basis was used in an output column `debt_basis`
(`present_value` | `face_value`).

```
# Step 1 — debt-carrying-capacity tier
tier = "strong"  if avg_wgi >= -0.20
       "medium"  if -0.80 <= avg_wgi < -0.20
       "weak"    if avg_wgi < -0.80
       null      if avg_wgi unavailable

# Step 2 — LIC-DSF thresholds by tier
THRESHOLDS = {
  weak:   { debt_gdp: 30, debt_exports: 140, ds_exports: 10 },
  medium: { debt_gdp: 40, debt_exports: 180, ds_exports: 15 },
  strong: { debt_gdp: 55, debt_exports: 240, ds_exports: 21 },
}

# Step 3 — PV preferred, face-value fallback
if PV series available:
    v_gdp, v_exp = PV_pct_GNI, PV_pct_exports          # "present_value"
else:
    v_gdp, v_exp = debt_stock_pct_GNI, debt_stock_pct_exports  # "face_value"

r_gdp = v_gdp / THRESHOLDS[tier].debt_gdp
r_exp = v_exp / THRESHOLDS[tier].debt_exports
r_ds  = debt_service_pct_exports / THRESHOLDS[tier].ds_exports

# Step 4–6
max_ratio = max(r_gdp, r_exp, r_ds)
category  = "Low"      if max_ratio < 0.75
            "Moderate" if 0.75 <= max_ratio < 1.0
            "High"     if max_ratio >= 1.0
norm_debt_risk = 1.0 (Low) | 0.5 (Moderate) | 0.0 (High)
```

### Limitations (surface in dashboard metadata / tooltips)

- DSF thresholds apply to **PPG** external debt; `DECT` / `PVLX` cover **total**
  external debt, which systematically overstates the burden, especially where
  private external borrowing is large.
- Face-value fallback reads worse for heavily concessional borrowers. Check
  `debt_basis`.
- Threshold is defined on debt/GDP; available series use GNI.
- Omits the official debt-service-to-revenue ratio (no clean API series).
- No forward-looking stress tests; cannot detect an actual "in distress"
  event, so the scale caps at High rather than the official 4th category.
- WGI tier cutoffs (−0.20 / −0.80) are a calibration judgment, not published
  IMF values.
- Thresholds were calibrated for concessional-borrower LICs. For upper-middle
  / high-income economies (IMF SRDSF) this is a rough directional read;
  consider flagging that subset as lower-confidence.

## 4. Non-concessional external debt (25%)

- **Source:** World Bank IDS.
- **Series:** `DT.DOD.ALLC.ZS` — concessional debt, % of total external debt.

```
raw = 100 - concessional_debt_pct
norm_nonconcessional = 1 - clip( raw / 100, 0, 1 )
```

After inversion, a higher concessional share scores better.

## Scope (updated revision, 2026-09-23)

The index covers the World Bank **International Debt Statistics (IDS)** set,
roughly 120 low- and middle-income economies (119 plus Guyana at the most
recent release). Two of the four components (debt distress proxy,
non-concessional share) are IDS series that do not exist outside that coverage,
and the LIC-DSF thresholds and 35% grant-element concessionality the index rests
on do not meaningfully apply to high-income economies.

Scope is **resolved live from country metadata**, so graduations are picked up
without a hardcoded list:

```
GET https://api.worldbank.org/v2/country/{iso3}?format=json  ->  lendingType.id
```

| `lendingType.id` | Meaning | In scope |
|---|---|---|
| `IBD` | IBRD | yes |
| `IDB` | Blend | yes |
| `IDX` | IDA | yes |
| `LNX` | Not classified | no |

Client caveat carried over verbatim: `lendingType` approximates DRS reporting
but is not identical to it. Recently graduated countries may still report for a
period, and Guyana is a documented high-income exception that remains in IDS.
Any country flagged `out_of_scope` that unexpectedly returns debt data is worth
reviewing.

**Implementation note (ours, not the client's):** do not issue one call per
iso3. `GET https://api.worldbank.org/v2/country?format=json&per_page=400`
returns every country with its `lendingType` in a single response. Same data,
one request instead of ~200.

**Limitation to record (ours, not the client's):** `lendingType` is a
*current-state* attribute. This is a timeseries product covering 1990-2024, so
applying today's lending classification to a 1994 observation is an anachronism.
A country that was IDA in 1994 and is `LNX` today will be marked `out_of_scope`
for its entire history. That is a defensible simplification, but it must be
stated in the About copy rather than discovered by a reader.

## Status and null handling (updated revision)

Every requested country appears in the output carrying a status. A null value
alone is not sufficient, because two different conditions produce one.

| `status` | Meaning | Composite |
|---|---|---|
| `scored` | in scope, all four components present | 0-100 |
| `out_of_scope` | outside IDS coverage; the index does not apply | `null` |
| `incomplete_data` | in scope, one or more components missing (see `missing_components`) | `null` |

**The dashboard filters on `status`, never on `null`.** The distinction is a
scope decision versus a data gap worth investigating, and collapsing them hides
pipeline regressions: an in-scope country that silently loses a component would
look identical to a high-income country that was never meant to be scored.

`partial_scores: false`. An out-of-scope country is **not** given a partial
score. The client's reasoning, which is correct and worth preserving: a score
built from only the two available components (income and governance) would be
systematically inflated, because the two missing components are precisely the
ones that could have pulled it down. Such a figure would not be a less precise
version of the full score. It would sit in the same column as fully-computed
scores while being biased upward.

This supersedes the original revision's coverage warning, and it is the
mechanism behind Reyna's 2026-09-24 note: "exclude countries that don't have
coverage from this index, so that we don't compare apples to oranges."

## Scope rule validated against live data (2026-09-24)

Ran the client's `lendingType` rule against the World Bank country endpoint and
cross-checked it with the 117 countries `MSPI_INDEX` currently scores.

| Set | Count |
|---|---|
| In scope by `lendingType` in {`IBD`, `IDB`, `IDX`} | **145** |
| Currently scored | **117** |
| Scored and in scope | **117** (the rule never wrongly excludes a scored country) |
| In scope but not scored, so `incomplete_data` | **28** |

Two things follow.

**1. The rule and the client's own stated count disagree.** The document says
scope is "roughly 120 low- and middle-income economies (119 plus Guyana)". The
rule as written yields 145. The 25-country gap is larger than the document's
"approximates DRS reporting" caveat implies.

**2. Roughly half the gap is mislabelled by construction.** Of the 28 that would
land in `incomplete_data`, 15 are High income IBRD graduates:

```
ATG BGR BRB CHL CRI HRV KNA NRU PAN PLW POL ROU SYC TTO URY
```

These are not data gaps. They are countries that graduated and stopped
reporting to the Debtor Reporting System, which is the definition of out of
scope in this index. Flagging them as "worth investigating" sends a reader
chasing data that will never exist. The remaining cases are genuine reporting
gaps or non-reporting states (`ERI`, `SSD`, `VEN`, `TKM`, `LBY`, `GNQ`, `NAM`,
`MYS`, and small Pacific and Caribbean states).

This is precisely the failure the `status` field exists to prevent, so the rule
that feeds it should not manufacture 14 false positives.

**Proposed refinement, needs Reyna's sign-off.** Keep her `lendingType` test as
the scope gate. Then, when assigning status, treat an in-scope country that is
**high income and has zero IDS observations across the whole window** as
`out_of_scope` rather than `incomplete_data`. That reclassifies exactly the
graduated non-reporters and leaves real gaps flagged. It also preserves her
documented Guyana exception without special-casing it: Guyana is `IDX`, does
report to IDS, and stays `scored` on its data rather than on its income label.
A blanket "exclude all high-income" filter would break Guyana, which is why the
test is on reported data rather than income alone.

## Delta against the original revision

Formula, weights, normalization bounds, series codes, WGI `source=3`, debt
tiering cutoffs, thresholds, classification bins and the score map are all
**unchanged**. What is new:

1. **Scope section** with the `lendingType.id` resolution rule and the
   `IBD` / `IDB` / `IDX` / `LNX` table. Previously there was no positive scope
   test at all; coverage was an emergent property of data availability.
2. **Three-value `status` field** (`scored` / `out_of_scope` /
   `incomplete_data`) plus a `missing_components` list on the third.
3. **Every requested country must appear in the output.** The original spec
   produced rows only where the composite computed.
4. **`scope` and `status_values` keys** added to the machine-readable summary.
5. Retrieval examples now pin `mrnev=1` on the WB API calls (see the warning
   below), and the limitations list gains a `DT.DOD.DPPG.CD` note and an
   instruction to validate the WGI tier cutoffs against published LIC-DSF
   ratings.

### What this costs us

`src/calculating/mspi.py` currently drops every incomplete row:

```python
complete = n_inc.notna() & n_frag.notna() & n_debt.notna() & n_conc.notna()
```

That single filter implements the old spec and contradicts the new one. To
satisfy the updated revision the composer needs a scope input it does not have,
a status column, a `missing_components` column, and it must stop dropping rows.
The published contract then needs a way to carry `status` to the frontend, which
is an additive field rather than a `/v2` bump under invariant 6.

### `mrnev=1` conflicts with this being a timeseries product

The updated retrieval examples specify `&mrnev=1`, which returns the **most
recent non-empty value only**, one point per country. Read literally that makes
`mspi` a snapshot indicator with no history, and `pri/macrosec` would have a
flat trend line on the Trends panel while the other six pillars move.

The formula itself is year-agnostic and composes fine per year, and we already
fetch full series. **Recommendation: keep the full series and treat `mrnev=1` as
the client describing a one-off lookup rather than specifying our retrieval.**
Confirm with Reyna before building, because if she does want a single latest
value it changes what the Trends panel shows for an entire pillar.

## Contract / keying

Contract key is `mspi` (2026-09-19). Pillar `repIndicator` is `mspi`. Do not
keep calling the composite `hdi`. Do not restore `conces`. Taxonomy maps
`mspi` → `MSPI_INDEX`. Composer: `src/calculating/mspi.py`.

## Machine-readable summary

```json
{
  "index_version": "1.0",
  "client_doc_revision": "2026-09-23",
  "weights": { "income": 0.25, "fragility": 0.25, "debt_risk": 0.25,
               "nonconcessional": 0.25 },
  "normalization": { "mode": "fixed_absolute_bounds", "clip": [0, 1] },
  "scope": {
    "basis": "World Bank IDS coverage",
    "resolved_from": "/v2/country/{iso3}?format=json -> lendingType.id",
    "in_scope_lending_types": ["IBD", "IDB", "IDX"],
    "out_of_scope_lending_types": ["LNX"],
    "partial_scores": false
  },
  "status_values": ["scored", "out_of_scope", "incomplete_data"],
  "indicators": {
    "income": {
      "source": "World Bank WDI", "series": ["NY.GDP.PCAP.CD"],
      "transform": "log_then_fixed_minmax",
      "bounds": { "lower": "ln(200)", "upper": "ln(150000)" },
      "direction": "higher_is_better"
    },
    "fragility": {
      "source": "World Bank WGI",
      "series": ["VA.EST","PV.EST","GE.EST","RQ.EST","RL.EST","CC.EST"],
      "api_source_param": 3,
      "transform": "mean_then_fixed_minmax",
      "bounds": { "lower": -2.5, "upper": 2.5 },
      "direction": "higher_is_better",
      "reused_by": ["debt_risk.tiering"]
    },
    "debt_risk": {
      "source": "World Bank IDS + WGI (tiering)",
      "series_preferred": ["DT.DOD.PVLX.GN.ZS", "DT.DOD.PVLX.EX.ZS"],
      "series_fallback": ["DT.DOD.DECT.GN.ZS", "DT.DOD.DECT.EX.ZS"],
      "series_debt_service": ["DT.TDS.DECT.EX.ZS"],
      "basis_recorded_as": "debt_basis",
      "transform": "proxy_classification",
      "tier_input": "avg_wgi",
      "tier_cutoffs": { "strong_min": -0.20, "medium_min": -0.80 },
      "tier_if_input_missing": null,
      "tiers": {
        "weak":   { "debt_gdp": 30, "debt_exports": 140, "ds_exports": 10 },
        "medium": { "debt_gdp": 40, "debt_exports": 180, "ds_exports": 15 },
        "strong": { "debt_gdp": 55, "debt_exports": 240, "ds_exports": 21 }
      },
      "classification_bins": { "low_max_ratio": 0.75, "moderate_max_ratio": 1.0 },
      "score_map": { "Low": 1.0, "Moderate": 0.5, "High": 0.0 },
      "direction": "higher_is_better"
    },
    "nonconcessional": {
      "source": "World Bank IDS", "series": ["DT.DOD.ALLC.ZS"],
      "transform": "invert_then_fixed_minmax",
      "bounds": { "lower": 0, "upper": 100 },
      "direction": "higher_is_better_after_inversion"
    }
  }
}
```

## Implementation ownership

Thomas owns remaining delivery as of 2026-09-19. Contract key `mspi` is in
`docs/data-contract.md`, `publish_dashboard.py`, and `indicators.yaml`.
Composer is wired (`src/calculating/mspi.py`, taxonomy `mspi` → `MSPI_INDEX`).
WDI/IDS fetched and scored 2026-09-19: **117 countries / 1,693 country-years**
vs HDI **193 / 2,688** (2010–2024). High-income non-reporters are null.
Coverage confirmed by the client 2026-09-24: exclude non-covered countries.
The updated spec revision (2026-09-23) replaces that with an explicit
`lendingType` scope test and a three-value status field, none of which is built
yet. About-page copy + tooltip/vintage UI still to do. Keep UNDP `HDI_INDEX` fetch as a verification
baseline. `DT.DOD.ALLC.ZS` and `DT.DOD.DECT.EX.ZS` must be fetched from IDS
source 6 with `counterpart_area: WLD` — they are archived on WDI.
