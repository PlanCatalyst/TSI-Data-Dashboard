import type { CountriesPayload, MetaPayload, TimeseriesPayload } from "./types";

function latestNonNull(series: Array<number | null>): number | null {
  return series.reduceRight<number | null>((acc, v) => acc ?? v, null);
}

function roundedAverage(vals: number[]): number | null {
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

export function computePillarScores(
  countries: CountriesPayload,
  meta: MetaPayload,
  timeseries: TimeseriesPayload
): Record<string, Record<string, number | null>> {
  const indsByPillar: Record<string, string[]> = {};
  for (const ind of meta.indicators) {
    (indsByPillar[ind.pillar] ??= []).push(ind.key);
  }
  const result: Record<string, Record<string, number | null>> = {};
  for (const c of countries) {
    result[c.iso3] = {};
    for (const p of meta.pillars) {
      const keys = indsByPillar[p.key] ?? [];
      const vals = keys
        .map(k => latestNonNull(timeseries[c.iso3]?.[k] ?? []))
        .filter((v): v is number => v != null);
      result[c.iso3][p.key] = roundedAverage(vals);
    }
  }
  return result;
}

export function computePillarTimeseries(
  countries: CountriesPayload,
  meta: MetaPayload,
  timeseries: TimeseriesPayload
): Record<string, Record<string, Array<number | null>>> {
  const indsByPillar: Record<string, string[]> = {};
  for (const ind of meta.indicators) {
    (indsByPillar[ind.pillar] ??= []).push(ind.key);
  }
  const result: Record<string, Record<string, Array<number | null>>> = {};
  for (const c of countries) {
    result[c.iso3] = {};
    for (const p of meta.pillars) {
      const keys = indsByPillar[p.key] ?? [];
      result[c.iso3][p.key] = meta.years.map((_, yi) => {
        const vals = keys
          .map(k => (timeseries[c.iso3]?.[k] ?? [])[yi] ?? null)
          .filter((v): v is number => v != null);
        return roundedAverage(vals);
      });
    }
  }
  return result;
}

export function computeSdScores(
  countries: CountriesPayload,
  meta: MetaPayload,
  timeseries: TimeseriesPayload
): Record<string, Record<string, number | null>> {
  const indsBySubdomain: Record<string, string[]> = {};
  for (const ind of meta.indicators) {
    (indsBySubdomain[ind.subdomain] ??= []).push(ind.key);
  }
  const result: Record<string, Record<string, number | null>> = {};
  for (const c of countries) {
    result[c.iso3] = {};
    for (const sd of meta.subdomains) {
      const keys = indsBySubdomain[sd.key] ?? [];
      const vals = keys
        .map(k => latestNonNull(timeseries[c.iso3]?.[k] ?? []))
        .filter((v): v is number => v != null);
      result[c.iso3][sd.key] = roundedAverage(vals);
    }
  }
  return result;
}
