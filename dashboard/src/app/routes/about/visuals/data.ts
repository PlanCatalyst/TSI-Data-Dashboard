import type { CSSProperties } from "react";

import type { MetaPayload, TimeseriesPayload } from "../../../../data/contract/types";
import { BASKET_MIN_PRESENCE, BASKET_WINDOW_YEARS } from "../../../../data/contract/selectors";
import { LABEL_OVERRIDES } from "../../../../content/about/methodology";
import { SNAPSHOT_ID } from "../../../../content/about/snapshot";

/** Helpers that read the published contract for the About visuals. One pass per country or indicator. */

export function indicatorLabel(meta: MetaPayload, key: string): string {
  return LABEL_OVERRIDES[key] ?? meta.indicators.find((i) => i.key === key)?.label ?? key;
}

/** A short label for charts and tables: cut at the first comma or bracket, capped in length. */
export function shortLabel(label: string, max = 44): string {
  const cut = label.split(/[,(]/)[0].trim();
  return cut.length > max ? `${cut.slice(0, max - 1).trim()}...` : cut;
}

export function seriesOf(ts: TimeseriesPayload, iso3: string, key: string, length: number): Array<number | null> {
  return ts[iso3]?.[key] ?? Array.from({ length }, () => null);
}

/**
 * The retired rule: the mean of whatever indicators reported that year, with no
 * fixed basket. Used only to show what the basket rule removed (DQ-03).
 */
export function plainMeanSeries(members: Array<Array<number | null>>, length: number): Array<number | null> {
  return Array.from({ length }, (_, i) => {
    const vals = members.map((m) => m[i]).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
}

/** Which members fall in the basket: a value in the last BASKET_WINDOW_YEARS of the series. */
export function basketMembers(members: Array<Array<number | null>>, length: number): boolean[] {
  const nonEmpty = members.map((m) => m.some((v) => v != null));
  let last = -1;
  for (let i = length - 1; i >= 0 && last < 0; i--) {
    if (members.some((m, k) => nonEmpty[k] && m[i] != null)) last = i;
  }
  const lo = last - BASKET_WINDOW_YEARS + 1;
  return members.map((m, k) => {
    if (!nonEmpty[k]) return false;
    for (let i = Math.max(0, lo); i <= last; i++) if (m[i] != null) return true;
    return false;
  });
}

/** Years in which the basket rule would score the pillar. */
export function scoredYears(members: Array<Array<number | null>>, length: number): boolean[] {
  const inBasket = basketMembers(members, length);
  const basket = members.filter((_, k) => inBasket[k]);
  const need = Math.max(1, Math.ceil(BASKET_MIN_PRESENCE * basket.length));
  return Array.from({ length }, (_, i) => basket.filter((m) => m[i] != null).length >= need && basket.length > 0);
}

/** Share of countries with a value, per indicator and year. Built once, memoise at the call site. */
export function coverageMatrix(
  ts: TimeseriesPayload,
  meta: MetaPayload,
): Record<string, number[]> {
  const isos = Object.keys(ts);
  const n = meta.years.length;
  const out: Record<string, number[]> = {};
  for (const ind of meta.indicators) {
    const counts = new Array<number>(n).fill(0);
    for (const iso of isos) {
      const s = ts[iso]?.[ind.key];
      if (!s) continue;
      for (let i = 0; i < n; i++) if (s[i] != null) counts[i]++;
    }
    out[ind.key] = counts.map((c) => (isos.length ? c / isos.length : 0));
  }
  return out;
}

const coverageCache = new WeakMap<TimeseriesPayload, Record<string, number[]>>();

/** coverageMatrix, computed once per loaded contract and shared by every visual that needs it. */
export function getCoverage(ts: TimeseriesPayload, meta: MetaPayload): Record<string, number[]> {
  const hit = coverageCache.get(ts);
  if (hit) return hit;
  const built = coverageMatrix(ts, meta);
  coverageCache.set(ts, built);
  return built;
}

/** Per-year coverage for a group of indicators: the best share among them. */
export function groupCoverage(matrix: Record<string, number[]>, keys: string[], length: number): number[] {
  return Array.from({ length }, (_, i) => Math.max(0, ...keys.map((k) => matrix[k]?.[i] ?? 0)));
}

/** Text for a visual built on static figures, or null when they match the loaded snapshot. */
export function snapshotNote(meta: MetaPayload | null): string | null {
  if (!meta) return null;
  return meta.pipelineRunId === SNAPSHOT_ID ? null : `Figures from snapshot ${SNAPSHOT_ID}`;
}

export function fmt1(v: number | null | undefined): string {
  return v == null ? "no data" : String(Math.round(v * 10) / 10);
}

/** Typed way to set CSS custom properties from React. */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}
