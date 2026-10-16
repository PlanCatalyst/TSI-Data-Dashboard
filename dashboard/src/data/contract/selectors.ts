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
// Basket mean (data quality issue DQ-03). Mirrors
// src/calculating/pillar_aggregate.py exactly: the basket is the members with
// any value in the last BASKET_WINDOW_YEARS of the series; a year is the mean
// over basket members present that year only when at least
// BASKET_MIN_PRESENCE of the basket is present, else null. Members outside
// the basket are ignored. A plain mean of "whatever reported that year"
// changes composition year to year and drew a zigzag through every country
// from 1995 to 2002 (biennial governance data).
export const BASKET_WINDOW_YEARS = 5;
export const BASKET_MIN_PRESENCE = 0.75;

export function basketSeries(members: Array<Array<number | null>>, length: number): Array<number | null> {
  const nonEmpty = members.filter((m) => m.some((v) => v != null));
  if (nonEmpty.length === 0) return Array.from({ length }, () => null);
  let last = -1;
  for (let i = length - 1; i >= 0 && last < 0; i--) {
    if (nonEmpty.some((m) => m[i] != null)) last = i;
  }
  const lo = last - BASKET_WINDOW_YEARS + 1;
  const basket = nonEmpty.filter((m) => {
    for (let i = Math.max(0, lo); i <= last; i++) if (m[i] != null) return true;
    return false;
  });
  const need = Math.max(1, Math.ceil(BASKET_MIN_PRESENCE * basket.length));
  return Array.from({ length }, (_, i) => {
    const vals = basket.map((m) => m[i]).filter((v): v is number => v != null);
    return vals.length >= need ? meanRound(vals) : null;
  });
}

export function computePillarTimeseries(
  country: CountryPayload,
  timeseries: TimeseriesPayload,
  meta: MetaPayload,
): Record<string, Array<number | null>> {
  const indsByPillar = groupIndicatorKeysByPillar(meta);
  const result: Record<string, Array<number | null>> = {};
  const n = meta.years.length;
  for (const p of meta.pillars) {
    const keys = indsByPillar[p.key] ?? [];
    const members = keys.map((k) => timeseries[country.iso3]?.[k] ?? Array.from({ length: n }, () => null));
    result[p.key] = basketSeries(members, n);
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

// Overall score for display. Per the data contract, `country.overall` is null
// whenever any pillar is null; the dashboard shows that as no data rather than
// averaging the pillars that exist (decided 2026-10-15).
export function displayOverall(country: CountryPayload): number | null {
  return country.overall;
}

export type TrendBucket = "up" | "down" | "flat" | "unknown";

// Categorise a trend delta with a small dead band so noise reads as flat.
export function trendBucket(delta: number | null, threshold = 3): TrendBucket {
  if (delta == null) return "unknown";
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "flat";
}
