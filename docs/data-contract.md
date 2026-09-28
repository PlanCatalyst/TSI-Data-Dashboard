# Dashboard Data Contract — v1

**Status:** authoritative. The pipeline's publish step emits three JSON files that
conform exactly to the shapes below. The frontend reads *only* these files. Any
change here is a versioned contract change (bump `/v1/` → `/v2/` and keep both).

**2026-09-19:** `pri.repIndicator` and the `pri/macrosec` indicator key are `mspi`
(Country Macro Socio-Economic Performance Index), replacing the interim `hdi`
stopgap. Same slot, still 28 indicators, still `/v1/` — same class of in-place
replacement as `conces` → `hdi` (2026-06-01). Spec: `docs/spec-macrosec-index.md`.
Composer is wired (`src/calculating/mspi.py` → `MSPI_INDEX`). Local score
2026-09-19: 117 countries / 1,693 country-years (2010–2024) vs HDI 193 / 2,688.
Do not live-publish until PlanCatalyst confirms that coverage drop. HDI stays
fetched as a verification baseline and no longer occupies this slot.

**Publish location:** `https://<account>.blob.core.windows.net/dashboard-public/v1/`

```
/v1/meta.json
/v1/countries.json
/v1/timeseries.json
```

Content-Type: `application/json; charset=utf-8`
Cache-Control: `public, max-age=3600`
Anonymous read enabled; CORS allows Wix domain + localhost dev/preview.

The shapes are derived directly from the client mock (`PlanCatalyst TSI Data Dashboard Final.html`,
lines 602–867). Semantics in this document win; if the mock and this document
disagree, update this document to match the mock and file an issue.

---

## 1. Conventions

- **Encoding**: UTF-8, two-space indent in pretty output; publisher may emit
  minified.
- **Numbers**: all numeric scores are in `[0, 100]`, higher = more favourable
  (see §5).
- **Nulls**: missing observations are represented as `null` (JSON null). Never
  omit the key, never use `NaN` or `0` as a sentinel. A `null` on its own does
  not say *why* the value is absent; where that distinction matters, an
  indicator carries a `status` (see §3.1).
- **Country identifier**: `iso3` (3-letter ISO 3166-1 alpha-3, e.g. `"KEN"`) is
  the canonical join key across all three files. `id` (ISO numeric) is kept for
  the map (TopoJSON keys numeric).
- **Region codes** (World Bank, 8 values):
  `afe, afw, eap, eca, lcr, mna, sar, nam`.
- **Pillar keys** (7):
  `health, ag, si, women, climate, ctx, pri`.
  These match the frontend `DOMAIN_META` / Explore column groupings. Note: the
  mock's historical `cc` cross-cutting domain is split here into `women` and
  `climate` (frontend does this split in the Explore table; backend publishes
  them separately to avoid the split happening in two places).
- **Years**: integer calendar years, no decimals. Ordered ascending.

---

## 2. `meta.json`

Static-ish metadata describing the dataset's shape. Frontend reads once at
bootstrap, caches in React context.

```jsonc
{
  "schemaVersion": "1.0.0",
  "generatedAt": "2026-04-23T12:00:00Z",
  "pipelineRunId": "2026H1-abcdef01",
  "scoringDirection": "higher_is_better",
  "years": [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  "projections": {
    "enabled": false,
    "firstProjectedYear": null,
    "note": "Projection band coming soon."
  },
  "regions": [
    { "code": "afe", "label": "Africa Eastern & Southern" },
    { "code": "afw", "label": "Africa Western & Central" },
    { "code": "eap", "label": "East Asia & Pacific" },
    { "code": "eca", "label": "Europe & Central Asia" },
    { "code": "lcr", "label": "Latin America & Caribbean" },
    { "code": "mna", "label": "Middle East & North Africa" },
    { "code": "sar", "label": "South Asia" },
    { "code": "nam", "label": "North America" }
  ],
  "pillars": [
    { "key": "health",   "label": "Healthcare",                "color": "#0079c1", "repIndicator": "uhc"    },
    { "key": "ag",       "label": "Agriculture",               "color": "#7a9a1f", "repIndicator": "food"   },
    { "key": "si",       "label": "Social infrastructure",     "color": "#435d7f", "repIndicator": "water"  },
    { "key": "women",    "label": "Gender equality",           "color": "#817d77", "repIndicator": "gii"    },
    { "key": "climate",  "label": "Climate adaptation",        "color": "#7a6a30", "repIndicator": "ndgain" },
    { "key": "ctx",      "label": "Country context",           "color": "#a05020", "repIndicator": "state"  },
    { "key": "pri",      "label": "Socio-economic performance","color": "#3a5a6a", "repIndicator": "mspi"   }
  ],
  "subdomains": [
    { "key": "phc",      "label": "Resilient primary healthcare systems", "pillar": "health" },
    { "key": "infect",   "label": "Infectious disease control",           "pillar": "health" },
    { "key": "mnch",     "label": "Maternal, newborn & child health",     "pillar": "health" },
    { "key": "nutr",     "label": "Nutrition",                            "pillar": "health" },
    { "key": "repro",    "label": "Reproductive health & family planning","pillar": "health" },
    { "key": "hrisk",    "label": "Health risk reduction & management",   "pillar": "health" },
    { "key": "foodsec",  "label": "Food security",                        "pillar": "ag"     },
    { "key": "agrivc",   "label": "Agricultural systems & value chains",  "pillar": "ag"     },
    { "key": "wash",     "label": "Water, sanitation & hygiene",          "pillar": "si"     },
    { "key": "energy",   "label": "Off-grid power & clean energy",        "pillar": "si"     },
    { "key": "digfin",   "label": "Digital financial inclusion",          "pillar": "si"     },
    { "key": "women",    "label": "Gender equality",                      "pillar": "women"  },
    { "key": "climate",  "label": "Climate adaptation",                   "pillar": "climate"},
    { "key": "statecap", "label": "State & partner capacity",             "pillar": "ctx"    },
    { "key": "poverty",  "label": "Poverty & livelihoods",                "pillar": "ctx"    },
    { "key": "ctxmisc",  "label": "Additional country context",           "pillar": "ctx"    },
    { "key": "macrosec", "label": "Socio-economic performance",           "pillar": "pri"    }
  ],
  "indicators": [
    {
      "key": "uhc",
      "label": "Coverage of essential health services",
      "sdg": "SDG 3.8.1",
      "source": "SDG Indicators Database",
      "unit": "Index 0-100 (geometric mean of 14 tracer indicators)",
      "pillar": "health",
      "subdomain": "phc",
      "rawDirection": "higher_is_better",
      "scoredDirection": "higher_is_better"
    }
    // ... 27 more; one per indicator, in stable display order ...
  ]
}
```

### Field notes

- `schemaVersion`: SemVer. Major bump = breaking; minor = additive; patch =
  doc/fix. Frontend hard-fails on a major mismatch.
- `generatedAt`: ISO-8601 UTC. Shown in About view.
- `pipelineRunId`: opaque string identifying the pipeline run that produced this
  snapshot; used for support / debugging.
- `scoringDirection`: constant `"higher_is_better"` for now. Frontend treats
  this as an invariant; if the backend ever changes directionality it MUST bump
  the schema major.
- `years`: same for every country; publisher pads with trailing nulls per
  country where data ends earlier. Frontend assumes this array defines index
  positions for every `timeseries.json` array.
- `projections.enabled`: if `false`, frontend hides the projection band and
  shows the `note` text.
- `pillars[*].repIndicator`: single indicator whose score is used as the pillar
  score when a pillar has exactly one indicator (women, climate, pri). Also
  lets the frontend draw a "headline indicator" badge per pillar.
- `indicators[*].rawDirection` / `scoredDirection`: see §5.

---

## 3. `countries.json`

Array of one object per country (~185 entries). Drives Explore table, Compare
strip chart, Map choropleth, and Map country detail panel.

```jsonc
[
  {
    "id": 404,
    "iso3": "KEN",
    "name": "Kenya",
    "region": "afe",
    "scores": {
      "health":  62.1,
      "ag":      48.7,
      "si":      55.4,
      "women":   41.2,
      "climate": 39.8,
      "ctx":     52.0,
      "pri":     58.3
    },
    "overall": 51.1,
    "trend": [49.2, 49.5, 49.8, 50.1, 50.4, 50.9, 51.4, 51.0, 50.7, 50.9, 51.1]
  }
  // ... ~184 more ...
]

// Note: trend.length MUST equal meta.years.length. The example above has 11
// entries because meta.years has 11 entries (2014-2024). If a country has no
// data for a given year, the position is null, not omitted.
```

### Field notes

- `id`: ISO-3166-1 numeric (integer). Required because the frontend's
  TopoJSON map keys countries by numeric id.
- `iso3`: 3-letter alpha. Join key for `timeseries.json`.
- `name`: display name. Publisher takes from `indicators/country_codes.csv`
  (single source of truth).
- `region`: one of the 8 WB codes in `meta.regions[].code`.
- `scores.<pillar>`: 0-100 rounded to 1 decimal. `null` if insufficient data
  to compute (publisher decides threshold; document once decided).
- `overall`: arithmetic mean of the 7 pillar scores, rounded to 1 decimal.
  `null` if any pillar is `null`.
- `trend`: length MUST equal `meta.years.length`. Values are the country's
  `overall` score computed per year using that year's pillar scores. Nulls
  preserved. Powers the sparkline in the Explore table.

- `indicatorStatus`: **optional**, added 2026-09-24. Map of indicator key to a
  status object, present only for indicators that define a status model. See
  §3.1. Consumers that do not know the key ignore it.

**Ordering**: alphabetical by `name` is recommended but not contractually
required. Frontend sorts client-side anyway.

---

### 3.1 `indicatorStatus` (additive, 2026-09-24)

**Why this exists.** A `null` score answers "is there a value" but not "should
there have been one". Those are different questions with different consequences:
a country that is outside an index's defined scope is a correct, permanent
absence, while a country inside scope with missing inputs is a data gap somebody
may need to chase. Collapsing both into `null` loses the distinction and makes
every absence look like a defect.

This was introduced by PlanCatalyst's 2026-09-23 revision of the `mspi`
specification (`docs/client-specs/`), which requires every country to appear in
the output labelled with the reason it does or does not carry a score.

**Shape.** Additive and optional. Absent for the 27 indicators that have no
status model.

```jsonc
{
  "iso3": "POL",
  "scores": { "pri": null, /* ... */ },
  "indicatorStatus": {
    "mspi": {
      "status": "out_of_scope",
      "missingComponents": []
    }
  }
}
```

**Values of `status`:**

| Value | Meaning | Score |
|---|---|---|
| `scored` | In scope, all required components present. | number in `[0, 100]` |
| `out_of_scope` | Outside the index's defined population. Not a data gap, and not actionable. | `null` |
| `incomplete_data` | In scope, but one or more required components are missing. Potentially actionable. | `null` |

**`missingComponents`**: array of component identifiers, populated only when
`status` is `incomplete_data`, empty otherwise. Never `null`. For `mspi` the
identifiers are `income`, `fragility`, `debt_risk` and `concessionality`, in
spec order. The list names the components absent in the most recent year that
has any component data, so it is never empty on `incomplete_data`; a country
with no component data at all lists all four.

**Invariants:**

1. `status: "scored"` requires at least one non-null entry for that indicator
   in `timeseries.json`. (`countries.json` carries pillar scores only, so the
   indicator-level check lives on the timeseries.)
2. `out_of_scope` and `incomplete_data` both require every `timeseries.json`
   entry for that indicator to be `null`. The status explains the null, it
   never substitutes for one.
3. `missingComponents` is non-empty if and only if `status` is
   `incomplete_data`.
4. When any country carries a status for an indicator, every country does.
   A country the pipeline never saw for that indicator is `out_of_scope`.

**Source.** The calc stage writes `data/interim/validated/indicator_status.csv`
(`country_code, indicator_key, status, missing_components`) next to the score
CSVs; the publisher reshapes it and omits `indicatorStatus` entirely when the
file is absent. Scope comes from the World Bank country metadata
(`lendingType.id`, cleaned to `ids_in_scope`), the rule as written in the
2026-09-23 client revision. The three open questions on that rule in
`docs/spec-macrosec-index.md` change values, not shape.

**Granularity: country-level, not country-year.** Scope is resolved from the
World Bank lending classification, which the API exposes only as current state
with no history, so a per-year scope value would be fabricated precision. A
country-level `incomplete_data` therefore means "no year in the published range
has a complete component set"; per-year absence remains visible as nulls in the
`timeseries.json` array. Revisit if the World Bank ever publishes a historical
lending classification series.

**Version impact: none.** Adding an optional key is backward compatible under
invariant 6 of `CLAUDE.md`. Existing consumers that ignore `indicatorStatus`
continue to read valid payloads, so this stays on `/v1/`. Changing the meaning
of an existing key, or making this one required, would not.

**Frontend obligation.** Rank, sort and comparison views must treat
`out_of_scope` as excluded from the ranking rather than as a low score. A
country with no index value is not a country that performed worst.

---

## 4. `timeseries.json`

Per-country × per-indicator time-series arrays. Powers the country detail
panel's Chart.js line plot and the sub-domain aggregation the frontend does
client-side (matching `subVal` in the client mock).

```jsonc
{
  "KEN": {
    "uhc":    [52, 54, 55, 56, 58, 60, 61, 62, 63, null, null],
    "tb":     [40, 41, 43, 45, 46, 48, 50, 51, 52, 53, 54],
    // ... one entry per indicator key ...
    "mspi":   [null, null, 47, 48, 49, 50, 51, 52, 53, 53, 54]
  },
  "TZA": {
    "uhc":    [/* ... */]
  }
  // ... all countries present in countries.json ...
}
```

### Field notes

- Top-level keys: every `iso3` from `countries.json`. A country missing here is
  a bug.
- Second-level keys: every indicator `key` from `meta.indicators`. A country
  with no data for a given indicator still lists the key with an all-null array.
- Array length: ALWAYS `meta.years.length`. Position `i` corresponds to
  `meta.years[i]`.
- Values: the SCORED value in `[0, 100]` (higher = better), not the raw
  measurement. Raw source measurements remain internal pipeline artifacts and
  are not part of the frontend contract. `null` for missing observations.

**Size budget**: 185 countries × 28 indicators × 11 years × ~5 bytes/number
≈ 285 KB pretty-printed, ~180 KB minified, <60 KB gzipped. Within target.

---

## 5. Scoring direction

Every score the pipeline publishes obeys **higher = more favourable**.

The backend scoring formulas in `indicators/indicators.yaml` already invert
"higher-is-worse" raw measurements (e.g., TB incidence, maternal mortality)
during normalization. The `indicators[*].rawDirection` field in `meta.json`
documents the raw direction for display purposes (e.g., the detail panel can
label units as "rate per 100k (lower is better for raw values)"); `scoredDirection`
is always `"higher_is_better"`.

Frontend code can therefore render every number via the same colour scale
without per-indicator inversion logic. This is a hard invariant; see §1.

---

## 6. Frontend-side derivations (NOT in the contract)

These are computed in the browser from the published JSON and are listed here
only so backend engineers understand what NOT to ship:

- Sub-domain scores: arithmetic mean of their indicator scores (client-side,
  matches `subVal` at line 953). Backend could publish these later, but the
  MVP decision is "frontend computes".
- Regional averages: mean of country scores within a region, weighted equally.
  Computed client-side in the Explore regional panel.
- Per-country rankings, filtering, sorting: all client-side.
- Projected year values: not shipped. Frontend shows a faded band with
  "projections coming soon" until `meta.projections.enabled === true`.

---

## 7. Validation

The publish step MUST verify before upload:

1. `meta.regions`, `meta.pillars`, `meta.subdomains`, `meta.indicators` all
   non-empty; counts `8 / 7 / 17 / 28`.
2. Every country in `countries.json` has a `region` in `meta.regions[].code`.
3. Every `iso3` in `timeseries.json` appears in `countries.json`, and vice
   versa.
4. Every `timeseries.json[iso3]` has exactly the 28 indicator keys from
   `meta.indicators`, each an array of length `meta.years.length`.
5. All non-null numeric scores fall in `[0, 100]`.
6. Where `indicatorStatus` is present (§3.1): every `status` is one of
   `scored` / `out_of_scope` / `incomplete_data`; `scored` entries have a
   non-null score for that indicator; non-`scored` entries have a `null` score;
   `missingComponents` is non-empty exactly when `status` is
   `incomplete_data`.

A validation failure aborts the upload; the existing `/v1/` remains live.

---

## 8. Interval forecast rows (projections extension)

**Status:** preparatory for when `meta.projections.enabled` flips to `true`.
The historical `/v1/{meta,countries,timeseries}.json` shapes in §2–§4 are
unchanged by this section. When published, interval rows are written to
`/v1/projections.json` (array of the row shape below) **before** `meta.json`.
Publish is atomic: payload files first, `meta.json` last — a mid-payload
failure never writes meta, so the previous live snapshot stays marked ready.
Forecast rows are validated by `src.projections.validate.validate_payload`
**before** any publish that would ship them; a validation failure aborts
upload (same rule as §7).

Per `iso3 × indicator_code × year` projection row:

| Field | Required | Notes |
|-------|----------|-------|
| `iso3` | yes | 3-letter ISO 3166-1 alpha-3 join key |
| `indicator_code` | yes | Frontend indicator key (e.g. `"uhc"`) or stable series code |
| `year` | yes | Integer calendar year (projected year) |
| `value` | optional | Point estimate. May be `null` even on a `forecast` row when only an interval is published. Must be `null` on `unavailable` rows. |
| `value_lo` | yes* | Interval lower bound. Required (finite) when `status`/`record_type` is `"forecast"`; must be `null` when `"unavailable"`. |
| `value_hi` | yes* | Interval upper bound. Required (finite) when `"forecast"`; must be `null` when `"unavailable"`. Must satisfy `value_lo <= value_hi`. When `value` is present it must lie inside `[value_lo, value_hi]`. |
| `status` / `record_type` | yes (one of) | `"forecast"` or `"unavailable"`. Aliases: either key is accepted; if both are set they must agree. |
| `unavailable_reason` | conditional | Machine-readable gate code when status is `"unavailable"`; must be `null` on `"forecast"` rows. |

### Quality gates (eligibility)

Before a series may emit `"forecast"` rows, `src.projections.quality_gates.assess_series`
must pass for that `iso3 × indicator`. Failures produce `"unavailable"` rows
instead. Gate codes (also valid `unavailable_reason` values):

| Code | Rule |
|------|------|
| `insufficient_observations` | `n_obs < 8` |
| `insufficient_span` | `span_years < 8` where `span_years = last_obs_year - first_obs_year` |
| `stale_series` | `last_obs_year < end_year - 3` |
| `too_sparse` | missing fraction over the inclusive `[first_obs, last_obs]` window `> 0.4` |
| `no_signal` | near-zero variance among non-null observations |

### UX copy

Frontend must show a single shared string for any unavailable forecast, regardless
of which gate fired:

> Forecast unavailable due to insufficient information.

`unavailable_reason` is for logs / support only — do not invent per-reason user copy.

### Example rows

```jsonc
// Publishable interval forecast
{
  "iso3": "KEN",
  "indicator_code": "uhc",
  "year": 2027,
  "value": 62.0,
  "value_lo": 58.0,
  "value_hi": 66.0,
  "status": "forecast",
  "unavailable_reason": null
}

// Gate failure — no numeric estimate
{
  "iso3": "SSD",
  "indicator_code": "uhc",
  "year": 2027,
  "value": null,
  "value_lo": null,
  "value_hi": null,
  "status": "unavailable",
  "unavailable_reason": "insufficient_observations"
}
```

