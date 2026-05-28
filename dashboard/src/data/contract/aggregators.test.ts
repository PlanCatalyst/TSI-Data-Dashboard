import { describe, it, expect } from "vitest";
import { computePillarScores, computePillarTimeseries, computeSdScores } from "./aggregators";
import type { CountriesPayload, MetaPayload, TimeseriesPayload } from "./types";

// --- Fixtures ---

const makeCountry = (iso3: string) => ({
  id: 0, iso3, name: iso3, region: "SSA", scores: {}, overall: null, trend: [],
});

// Meta with one pillar ("health"), one subdomain ("basic_health"),
// two indicators (uhc, tb) and three years.
const META: MetaPayload = {
  schemaVersion: "1.0",
  generatedAt: "",
  pipelineRunId: "",
  scoringDirection: "higher_is_better",
  years: [2020, 2021, 2022],
  projections: { enabled: false, firstProjectedYear: null, note: "" },
  regions: [],
  pillars: [
    { key: "health", label: "Healthcare", color: "#0079c1", repIndicator: "uhc" },
  ],
  subdomains: [
    { key: "basic_health", label: "Basic Health", pillar: "health" },
  ],
  indicators: [
    { key: "uhc", label: "UHC", sdg: "", source: "", unit: "", pillar: "health", subdomain: "basic_health", rawDirection: "", scoredDirection: "" },
    { key: "tb",  label: "TB",  sdg: "", source: "", unit: "", pillar: "health", subdomain: "basic_health", rawDirection: "", scoredDirection: "" },
  ],
};

const COUNTRIES: CountriesPayload = [makeCountry("KEN"), makeCountry("NGA")];

// KEN has full data; NGA has a trailing null on uhc.
const TIMESERIES: TimeseriesPayload = {
  KEN: { uhc: [60, 80, 100], tb: [40, 60,  80] },
  NGA: { uhc: [50, 70, null], tb: [30, 50,  60] },
};

// --- computePillarScores ---

describe("computePillarScores", () => {
  it("averages the latest non-null value of each indicator", () => {
    // KEN: uhc latest=100, tb latest=80 → avg=90
    const scores = computePillarScores([makeCountry("KEN")], META, TIMESERIES);
    expect(scores["KEN"]["health"]).toBe(90);
  });

  it("uses latest non-null when the most recent year is null", () => {
    // NGA: uhc latest non-null=70 (2022 is null), tb latest=60 → avg=65
    const scores = computePillarScores([makeCountry("NGA")], META, TIMESERIES);
    expect(scores["NGA"]["health"]).toBe(65);
  });

  it("returns null when all indicator values are null", () => {
    const ts: TimeseriesPayload = { KEN: { uhc: [null, null], tb: [null, null] } };
    const scores = computePillarScores([makeCountry("KEN")], META, ts);
    expect(scores["KEN"]["health"]).toBeNull();
  });

  it("returns null for a country absent from timeseries", () => {
    const scores = computePillarScores([makeCountry("ETH")], META, TIMESERIES);
    expect(scores["ETH"]["health"]).toBeNull();
  });

  it("returns null for a pillar that has no indicators", () => {
    const metaExtraPillar: MetaPayload = {
      ...META,
      pillars: [...META.pillars, { key: "empty", label: "Empty", color: "#000", repIndicator: "" }],
    };
    const scores = computePillarScores([makeCountry("KEN")], metaExtraPillar, TIMESERIES);
    expect(scores["KEN"]["empty"]).toBeNull();
  });

  it("rounds the average to the nearest integer", () => {
    // uhc latest=1, tb latest=2 → avg=1.5 → rounds to 2
    const ts: TimeseriesPayload = { KEN: { uhc: [1], tb: [2] } };
    const meta: MetaPayload = { ...META, years: [2020] };
    const scores = computePillarScores([makeCountry("KEN")], meta, ts);
    expect(scores["KEN"]["health"]).toBe(2);
  });

  it("produces a result entry for every supplied country", () => {
    const scores = computePillarScores(COUNTRIES, META, TIMESERIES);
    expect(Object.keys(scores)).toEqual(["KEN", "NGA"]);
  });
});

// --- computePillarTimeseries ---

describe("computePillarTimeseries", () => {
  it("returns one value per year aligned to meta.years", () => {
    const ts = computePillarTimeseries([makeCountry("KEN")], META, TIMESERIES);
    expect(ts["KEN"]["health"]).toHaveLength(META.years.length);
  });

  it("averages all indicator values for each year", () => {
    // KEN yi=0: uhc=60, tb=40 → 50; yi=1: uhc=80, tb=60 → 70; yi=2: uhc=100, tb=80 → 90
    const ts = computePillarTimeseries([makeCountry("KEN")], META, TIMESERIES);
    expect(ts["KEN"]["health"]).toEqual([50, 70, 90]);
  });

  it("returns null for a year where all indicators are null", () => {
    const timedTs: TimeseriesPayload = { KEN: { uhc: [60, null, 100], tb: [40, null, 80] } };
    const ts = computePillarTimeseries([makeCountry("KEN")], META, timedTs);
    expect(ts["KEN"]["health"]).toEqual([50, null, 90]);
  });

  it("averages only the non-null indicators for a partial year", () => {
    // yi=1: uhc=80, tb=null → only uhc counted → 80
    const timedTs: TimeseriesPayload = { KEN: { uhc: [60, 80, null], tb: [40, null, null] } };
    const ts = computePillarTimeseries([makeCountry("KEN")], META, timedTs);
    expect(ts["KEN"]["health"]).toEqual([50, 80, null]);
  });

  it("returns all nulls for a country absent from timeseries", () => {
    const ts = computePillarTimeseries([makeCountry("ETH")], META, TIMESERIES);
    expect(ts["ETH"]["health"]).toEqual([null, null, null]);
  });
});

// --- computeSdScores ---

describe("computeSdScores", () => {
  it("averages the latest non-null value of each indicator per subdomain", () => {
    // KEN: uhc=100, tb=80 → avg=90
    const scores = computeSdScores([makeCountry("KEN")], META, TIMESERIES);
    expect(scores["KEN"]["basic_health"]).toBe(90);
  });

  it("uses latest non-null when the most recent year is null", () => {
    // NGA: uhc latest non-null=70, tb latest=60 → avg=65
    const scores = computeSdScores([makeCountry("NGA")], META, TIMESERIES);
    expect(scores["NGA"]["basic_health"]).toBe(65);
  });

  it("returns null for a subdomain with no indicators", () => {
    const metaExtraSd: MetaPayload = {
      ...META,
      subdomains: [...META.subdomains, { key: "empty_sd", label: "Empty", pillar: "health" }],
    };
    const scores = computeSdScores([makeCountry("KEN")], metaExtraSd, TIMESERIES);
    expect(scores["KEN"]["empty_sd"]).toBeNull();
  });

  it("only processes the supplied countries, not all countries", () => {
    const scores = computeSdScores([makeCountry("KEN")], META, TIMESERIES);
    expect(Object.keys(scores)).toEqual(["KEN"]);
    expect(scores["NGA"]).toBeUndefined();
  });

  it("returns null for a country absent from timeseries", () => {
    const scores = computeSdScores([makeCountry("ETH")], META, TIMESERIES);
    expect(scores["ETH"]["basic_health"]).toBeNull();
  });
});
