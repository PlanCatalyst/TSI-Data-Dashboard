import { useMemo, useState } from "react";

import { GATES } from "../../../../content/about/s09-missing-data";
import { LABEL_OVERRIDES } from "../../../../content/about/methodology";
import { seriesColor } from "../../../../components/scores/series-color";
import { useDashboardData } from "../../../../state/dashboard-context";
import { ShowAsTable } from "../ShowAsTable";
import { cssVars, getCoverage, shortLabel } from "./data";

/** Five gates a series must pass to be forecast. Illustrative while projections are off. */
function GateFunnel({ enabled }: { enabled: boolean }) {
  return (
    <div className="wiki-funnel">
      <p className="small wiki-viz-lead">
        {enabled
          ? "Projections are on in this update. We forecast a series only if it passes every check."
          : "Projections are off in this update. When they are on, we forecast a series only if it passes every check."}
      </p>
      <ol className="wiki-gates">
        {GATES.map((g, i) => (
          <li key={g.id} className="wiki-gate" style={cssVars({ "--w": `${100 - i * 6}%` })}>
            <span className="wiki-gate-n num">{i + 1}</span>
            <span>
              <b>{g.name}.</b> {g.test}
            </span>
          </li>
        ))}
        <li className="wiki-gate wiki-gate--out" style={cssVars({ "--w": "70%" })}>
          <span className="wiki-gate-n num" aria-hidden="true">
            +
          </span>
          <span>
            <b>Forecast shown</b> as a dashed line with an interval. A series that fails any check shows no forecast.
          </span>
        </li>
      </ol>
    </div>
  );
}

/**
 * Indicators down the side, years across the top, shaded by the share of
 * countries that report. Built from the loaded data in one pass.
 */
function CoverageHeatmap() {
  const { meta, timeseries } = useDashboardData();
  const matrix = useMemo(() => (meta ? getCoverage(timeseries, meta) : {}), [meta, timeseries]);
  const [focus, setFocus] = useState<{ key: string; year: number } | null>(null);
  if (!meta) return null;
  const years = meta.years;

  return (
    <div className="wiki-viz">
      <div className="wiki-heat" role="img" aria-label="Share of countries reporting each indicator, by year">
        <div className="wiki-heat-axis" aria-hidden="true">
          <span>{years[0]}</span>
          <span>{years[Math.floor(years.length / 2)]}</span>
          <span>{years[years.length - 1]}</span>
        </div>
        {meta.pillars.map((p) => (
          <div key={p.key} className="wiki-heat-group">
            {meta.indicators
              .filter((i) => i.pillar === p.key)
              .map((ind) => (
                <div key={ind.key} className="wiki-heat-row">
                  <div className="wiki-heat-label small">
                    <span className="wiki-tree-stripe" style={{ background: seriesColor(p.key) }} aria-hidden="true" />
                    {shortLabel(LABEL_OVERRIDES[ind.key] ?? ind.label, 40)}
                  </div>
                  <div className="wiki-heat-cells" style={{ gridTemplateColumns: `repeat(${years.length}, 1fr)` }}>
                    {matrix[ind.key]?.map((share, i) => (
                      <span
                        key={i}
                        className="wiki-heat-cell"
                        style={cssVars({ "--a": share.toFixed(3) })}
                        onPointerEnter={() => setFocus({ key: ind.key, year: years[i] })}
                        onPointerLeave={() => setFocus(null)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
      <p className="small wiki-readout" aria-live="polite">
        {focus
          ? `${shortLabel(LABEL_OVERRIDES[focus.key] ?? meta.indicators.find((i) => i.key === focus.key)?.label ?? focus.key, 48)}, ${focus.year}: ${Math.round(
              (matrix[focus.key]?.[years.indexOf(focus.year)] ?? 0) * 100,
            )}% of countries report`
          : "Hover a cell for the share of countries reporting. Dark means most countries, white means none."}
      </p>
      <ShowAsTable
        caption="Share of countries reporting, by indicator, for selected years"
        columns={["Indicator", String(years[0]), String(years[Math.floor(years.length / 2)]), String(years[years.length - 5]), String(years[years.length - 1])]}
        rows={meta.indicators.map((ind) => {
          const m = matrix[ind.key] ?? [];
          const at = (i: number) => `${Math.round((m[i] ?? 0) * 100)}%`;
          return [shortLabel(LABEL_OVERRIDES[ind.key] ?? ind.label, 48), at(0), at(Math.floor(years.length / 2)), at(years.length - 5), at(years.length - 1)];
        })}
      />
    </div>
  );
}

export function MissingData() {
  const { meta } = useDashboardData();
  return (
    <div className="wiki-stack">
      <GateFunnel enabled={meta?.projections.enabled === true} />
      <CoverageHeatmap />
    </div>
  );
}
