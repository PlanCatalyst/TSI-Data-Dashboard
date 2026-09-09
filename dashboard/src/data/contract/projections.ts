import type {
  MetaPayload,
  ProjectionRow,
  ProjectionStatus,
  ProjectionsPayload,
} from "./types";

/** Fixed UX copy from docs/data-contract.md §8 / src.projections.quality_gates. */
export const UX_UNAVAILABLE_COPY =
  "Forecast unavailable due to insufficient information." as const;

export type ProjectionIndex = Map<string, ProjectionRow>;

export function projectionJoinKey(iso3: string, indicatorCode: string, year: number): string {
  return `${iso3}::${indicatorCode}::${year}`;
}

/** Index rows for O(1) join on iso3 × indicator_code × year only. */
export function indexProjections(rows: ProjectionsPayload | undefined | null): ProjectionIndex {
  const map: ProjectionIndex = new Map();
  if (!rows) return map;
  for (const row of rows) {
    if (!row?.iso3 || !row.indicator_code || row.year == null) continue;
    map.set(projectionJoinKey(row.iso3, row.indicator_code, row.year), row);
  }
  return map;
}

export function getProjection(
  index: ProjectionIndex,
  iso3: string,
  indicatorCode: string,
  year: number,
): ProjectionRow | undefined {
  return index.get(projectionJoinKey(iso3, indicatorCode, year));
}

/** Resolve status / record_type aliases (§8). */
export function projectionStatus(row: ProjectionRow | undefined | null): ProjectionStatus | null {
  if (!row) return null;
  const status = row.status ?? row.record_type ?? null;
  if (status === "forecast" || status === "unavailable") return status;
  return null;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Plottable interval only for explicit forecast rows with finite bounds — never coerce null→0. */
export function forecastBand(
  row: ProjectionRow | undefined | null,
): { lo: number; hi: number; value: number | null } | null {
  if (projectionStatus(row) !== "forecast" || !row) return null;
  if (!isFiniteNumber(row.value_lo) || !isFiniteNumber(row.value_hi)) return null;
  const value = isFiniteNumber(row.value) ? row.value : null;
  return { lo: row.value_lo, hi: row.value_hi, value };
}

/** Calendar years for charts: historical meta.years plus projection years when enabled. */
export function chartYears(
  meta: MetaPayload,
  projections: ProjectionsPayload | undefined | null,
): number[] {
  const years = new Set<number>(meta.years);
  if (meta.projections?.enabled && projections) {
    for (const row of projections) {
      if (typeof row.year === "number" && Number.isFinite(row.year)) {
        years.add(row.year);
      }
    }
  }
  return [...years].sort((a, b) => a - b);
}

export type IndicatorProjectionView = {
  years: number[];
  /** Historical values aligned to `years` (null on projected-only years). */
  historical: Array<number | null>;
  /** Per-year band when status=forecast with finite lo/hi; else null. */
  bands: Array<{ lo: number; hi: number; value: number | null } | null>;
  /** True when any joined row for this series is unavailable. */
  hasUnavailable: boolean;
  /** True when projections.enabled and at least one year is at/after firstProjectedYear. */
  projectionsActive: boolean;
  firstProjectedYear: number | null;
};

/**
 * Join historical timeseries with §8 projection rows for one iso3 × indicator.
 * Does not invent midpoints or coerce nulls to 0.
 */
export function buildIndicatorProjectionView(args: {
  meta: MetaPayload;
  iso3: string;
  indicatorCode: string;
  historicalSeries: Array<number | null> | undefined;
  projectionIndex: ProjectionIndex;
  years?: number[];
}): IndicatorProjectionView {
  const { meta, iso3, indicatorCode, historicalSeries, projectionIndex } = args;
  const years = args.years ?? chartYears(meta, [...projectionIndex.values()]);
  const histByYear = new Map<number, number | null>();
  meta.years.forEach((y, i) => {
    histByYear.set(y, historicalSeries?.[i] ?? null);
  });

  const enabled = Boolean(meta.projections?.enabled);
  const firstProjectedYear = meta.projections?.firstProjectedYear ?? null;

  const historical: Array<number | null> = [];
  const bands: Array<{ lo: number; hi: number; value: number | null } | null> = [];
  let hasUnavailable = false;

  for (const year of years) {
    historical.push(histByYear.has(year) ? (histByYear.get(year) ?? null) : null);
    if (!enabled) {
      bands.push(null);
      continue;
    }
    const row = getProjection(projectionIndex, iso3, indicatorCode, year);
    const status = projectionStatus(row);
    if (status === "unavailable") {
      hasUnavailable = true;
      bands.push(null);
      continue;
    }
    bands.push(forecastBand(row));
  }

  return {
    years,
    historical,
    bands,
    hasUnavailable,
    projectionsActive: enabled,
    firstProjectedYear,
  };
}
