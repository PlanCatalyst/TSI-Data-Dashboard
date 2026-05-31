import type {
  CountriesPayload,
  CountryPayload,
  MetaPayload,
  TimeseriesPayload,
} from "./types";

// ── Basic lookups ────────────────────────────────────────────────────────────

export function getCountryByIso3(countries: CountriesPayload, iso3: string): CountryPayload | undefined {
  return countries.find((country) => country.iso3 === iso3);
}

export function getCountryById(countries: CountriesPayload, id: number): CountryPayload | undefined {
  return countries.find((country) => country.id === id);
}

export function getDefaultYear(meta: MetaPayload): number | null {
  return meta.years.length > 0 ? meta.years[meta.years.length - 1] : null;
}

export function sortCountriesByName(countries: CountriesPayload): CountriesPayload {
  return [...countries].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Indicator grouping helpers ───────────────────────────────────────────────

export function groupIndicatorKeysByPillar(meta: MetaPayload): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const ind of meta.indicators) {
    (out[ind.pillar] ??= []).push(ind.key);
  }
  return out;
}

export function groupIndicatorKeysBySubdomain(meta: MetaPayload): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const ind of meta.indicators) {
    (out[ind.subdomain] ??= []).push(ind.key);
  }
  return out;
}

// ── Score derivations ────────────────────────────────────────────────────────

// Latest non-null value in a series (walks from the end backward).
export function latestValue(series: Array<number | null> | undefined): number | null {
  if (!series) return null;
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v != null) return v;
  }
  return null;
}

function meanRound(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// Fallback pillar scores: latest non-null value per indicator, averaged per pillar.
// Use ONLY when `country.scores[pillar]` is null; this protects against gaps in
// the most recent year that would otherwise hide an otherwise-known score.
export function computeFallbackPillarScores(
  country: CountryPayload,
  timeseries: TimeseriesPayload,
  meta: MetaPayload,
): Record<string, number | null> {
  const indsByPillar = groupIndicatorKeysByPillar(meta);
  const result: Record<string, number | null> = {};
  for (const p of meta.pillars) {
    const keys = indsByPillar[p.key] ?? [];
    const vals = keys
      .map((k) => latestValue(timeseries[country.iso3]?.[k]))
      .filter((v): v is number => v != null);
    result[p.key] = meanRound(vals);
  }
  return result;
}

// Per-year pillar averages computed from each pillar's indicator timeseries.
// Used for trend charts to show year-by-year progression.
export function computePillarTimeseries(
  country: CountryPayload,
  timeseries: TimeseriesPayload,
  meta: MetaPayload,
): Record<string, Array<number | null>> {
  const indsByPillar = groupIndicatorKeysByPillar(meta);
  const result: Record<string, Array<number | null>> = {};
  for (const p of meta.pillars) {
    const keys = indsByPillar[p.key] ?? [];
    result[p.key] = meta.years.map((_, yi) => {
      const vals = keys
        .map((k) => (timeseries[country.iso3]?.[k] ?? [])[yi] ?? null)
        .filter((v): v is number => v != null);
      return meanRound(vals);
    });
  }
  return result;
}

// Subdomain scores: latest non-null value per indicator averaged per subdomain.
export function computeSubdomainScores(
  country: CountryPayload,
  timeseries: TimeseriesPayload,
  meta: MetaPayload,
): Record<string, number | null> {
  const indsBySubdomain = groupIndicatorKeysBySubdomain(meta);
  const result: Record<string, number | null> = {};
  for (const sd of meta.subdomains) {
    const keys = indsBySubdomain[sd.key] ?? [];
    const vals = keys
      .map((k) => latestValue(timeseries[country.iso3]?.[k]))
      .filter((v): v is number => v != null);
    result[sd.key] = meanRound(vals);
  }
  return result;
}

// Trend over a series: positive = rising, negative = falling, null if <2 values.
export function trendDelta(series: Array<number | null>): number | null {
  const vals = series.filter((v): v is number => v != null);
  return vals.length >= 2 ? vals[vals.length - 1] - vals[0] : null;
}

// Best-effort overall score for choropleth display. Per the data contract,
// `country.overall` is null whenever ANY pillar is null. With sparse real data
// that leaves most countries grey on the map, which doesn't match the
// reference's "every country always coloured" UI pattern. Fall back to the
// mean of whatever pillar scores ARE present so a country shows up as soon as
// it has any signal. Returns null only when there is genuinely no data at
// all — those countries stay in the no-data colour, no fake zeros.
export function displayOverall(country: CountryPayload): number | null {
  if (country.overall != null) return country.overall;
  const vals = Object.values(country.scores).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export type TrendBucket = "up" | "down" | "flat" | "unknown";

// Categorise a trend delta with a small dead band so noise reads as flat.
export function trendBucket(delta: number | null, threshold = 3): TrendBucket {
  if (delta == null) return "unknown";
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "flat";
}
