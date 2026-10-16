import { useMemo } from "react";

import { SOURCES } from "../../../content/about/sources";
import { useDashboardData } from "../../../state/dashboard-context";
import { getCoverage, groupCoverage } from "./visuals/data";

/** Years a source has any data, read from the loaded contract. */
export function useSourceYears() {
  const { meta, timeseries } = useDashboardData();
  return useMemo(() => {
    if (!meta) return {} as Record<string, { first: number | null; last: number | null; share: number[] }>;
    const matrix = getCoverage(timeseries, meta);
    const out: Record<string, { first: number | null; last: number | null; share: number[] }> = {};
    for (const s of SOURCES) {
      const share = groupCoverage(matrix, s.indicators, meta.years.length);
      const on = share.map((v, i) => (v > 0 ? meta.years[i] : null)).filter((y): y is number => y != null);
      out[s.id] = { first: on[0] ?? null, last: on[on.length - 1] ?? null, share };
    }
    return out;
  }, [meta, timeseries]);
}

