# Dashboard Data Contract — v1

**Status:** authoritative. The pipeline's publish step emits three JSON files that
conform exactly to the shapes below. The frontend reads *only* these files. Any
change here is a versioned contract change (bump `/v1/` → `/v2/` and keep both).

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
  omit the key, never use `NaN` or `0` as a sentinel.
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
    { "key": "pri",      "label": "Socio-economic performance","color": "#3a5a6a", "repIndicator": "hdi"    }
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

**Ordering**: alphabetical by `name` is recommended but not contractually
required. Frontend sorts client-side anyway.

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
    "hdi":    [null, null, 47, 48, 49, 50, 51, 52, 53, 53, 54]
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

A validation failure aborts the upload; the existing `/v1/` remains live.
