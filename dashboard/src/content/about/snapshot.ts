/**
 * Static figures behind the About visuals that cannot be computed from the
 * published contract: values from the cleaned source files, the proposed
 * scoring rule, and the audit. Every figure belongs to one snapshot. When the
 * loaded contract carries a different run id, the visual says "from snapshot
 * <id>" instead of presenting these as current (REQ9.13).
 */

export const SNAPSHOT_ID = "20261015T235428Z";

// ── Brazil, adolescent births (section 6) ───────────────────────────────────
// Score for each year when the pipeline took the first row it met in the
// source file (the old behaviour) versus the 15 to 19 age band (the rule).
// Row order alternated between the 10 to 14 band (about 3 births per 1,000,
// scores 100) and the 15 to 19 band (about 60 per 1,000).

export const BRAZIL_ABR = {
  iso3: "BRA",
  years: [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
  /** First row in file order. 100 where it was the 10 to 14 band. */
  before: [100, 25.5, 100, 27.4, 100, 27.4, 100, 29.2, 100, 30.6, 100, 31.2, 100, 31.4, 100, 32.0, 100, 35.6, 100, 39.4, 100, 43.9, 100],
  /** Ages 15 to 19 only, as published after the fix. */
  after: [24.5, 25.5, 26.7, 27.4, 27.7, 27.4, 28.5, 29.2, 29.6, 30.6, 31.7, 31.2, 31.3, 31.4, 31.3, 32.0, 34.6, 35.6, 36.9, 39.4, 42.5, 43.9, 49.8],
  /** Which band each "before" year came from. */
  bandBefore: ["10-14", "15-19", "10-14", "15-19", "10-14", "15-19", "10-14", "15-19", "10-14", "15-19", "10-14", "15-19", "10-14", "15-19", "10-14", "15-19", "10-14", "15-19", "10-14", "15-19", "10-14", "15-19", "10-14"],
} as const;

// ── Brazil, climate vulnerability (section 5) ───────────────────────────────
// Raw ND-GAIN vulnerability (0 to 1; lower is better) and the score under the
// current clamp versus the proposed soft floor. The soft floor maps the 0.46
// benchmark to 75 and spreads better values over 75 to 100 down to the best
// value in the data (Norway, 0.261).

export const BRAZIL_CLIMATE = {
  iso3: "BRA",
  benchmark: 0.46,
  bestObserved: 0.2609,
  years: [1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  raw: [0.4229, 0.4226, 0.4201, 0.4155, 0.4125, 0.4088, 0.4052, 0.3992, 0.3962, 0.3938, 0.3896, 0.386, 0.3854, 0.3836, 0.3809, 0.3795, 0.3783, 0.3775, 0.3747, 0.3731, 0.3699, 0.368, 0.3668, 0.3659, 0.3707, 0.3702, 0.3679, 0.3666, 0.3665, 0.3663],
  clamp: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  softFloor: [79.7, 79.7, 80.0, 80.6, 81.0, 81.4, 81.9, 82.6, 83.0, 83.3, 83.8, 84.3, 84.4, 84.6, 84.9, 85.1, 85.3, 85.4, 85.7, 85.9, 86.3, 86.5, 86.7, 86.8, 86.2, 86.3, 86.6, 86.7, 86.7, 86.8],
} as const;

// ── One record through the pipeline (section 3) ─────────────────────────────
// Brazil, tuberculosis incidence, 2024. The published value is also read live
// from the contract so a mismatch is visible.

export const TB_RECORD = {
  iso3: "BRA",
  indicator: "tb",
  year: 2024,
  seriesCode: "SH_TBS_INCD",
  value: 49.0,
  benchmark: 40,
  need: 18.4,
  published: 81.6,
} as const;

// ── Audit (section 11) ──────────────────────────────────────────────────────

export const AUDIT = {
  /** Fetch the audit ran against. */
  fetchRun: "20261015T001106Z",
  rawRecords: 365000,
  before: { expected: 97070, match: 97011, mismatch: 0, missing: 59, extra: 557 },
  after: { expected: 97038, match: 97038, mismatch: 0, missing: 0, extra: 15 },
  tolerance: 0.15,
  unexplainedDrops: 0,
  /** Defects the audit found, all fixed except the one with a decision pending. */
  defects: [
    { id: "aid-needs-gdp", label: "Agriculture aid scored without national income", rows: 60, status: "locked" },
    { id: "national-totals-only", label: "City-only rows shown as national", rows: 482, status: "locked" },
    { id: "country-codes", label: "Andorra governance series lost to an old country code", rows: 26, status: "locked" },
    { id: "survey-years", label: "One poverty survey wave dropped", rows: 1, status: "locked" },
    { id: "debt-risk-input", label: "Debt risk scored from a partial input", rows: 15, status: "pending" },
  ],
} as const;

// ── What changed since the last release (section 14) ────────────────────────

export const CHANGELOG: { date: string; text: string }[] = [
  { date: "2026-10-19", text: "Renewable energy and family planning now score against a floor: 0 at or below the benchmark (a 20% share; the 77.2% global average), rising to 100 for the best country on record." },
  { date: "2026-10-15", text: "Independent check: we rebuilt every published score from the raw source files. 97,038 of 97,038 match." },
  { date: "2026-10-15", text: "We fixed four publishing problems: aid without national income, city-only rows, a retired country code and a dropped survey year." },
  { date: "2026-10-15", text: "The overall score now needs a score on all six core pillars. Socio-economic performance is included when present." },
  { date: "2026-10-14", text: "Pillar, overall and regional lines now use a fixed set of indicators, which removes the early-year zigzag." },
  { date: "2026-10-14", text: "We now use one source row per country and year, so adolescent births, health emergency preparedness and bank accounts no longer jump up and down." },
];
