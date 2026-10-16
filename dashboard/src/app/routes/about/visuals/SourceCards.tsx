import { SOURCES } from "../../../../content/about/sources";
import { useDashboardData } from "../../../../state/dashboard-context";
import { ShowAsTable } from "../ShowAsTable";
import { cssVars } from "./data";
import { useSourceYears } from "../useSourceYears";

/** Section 10: one row per source with a coverage bar across the years. */
export function SourceCards() {
  const { meta } = useDashboardData();
  const yrs = useSourceYears();
  if (!meta) return null;
  const n = meta.years.length;

  return (
    <div className="wiki-viz">
      <div className="wiki-srcbars">
        {SOURCES.map((s) => {
          const y = yrs[s.id];
          return (
            <div key={s.id} className="wiki-srcbar">
              <div className="wiki-srcbar-head">
                <b>{s.name}</b>
                <span className="small num">
                  {y?.first && y?.last ? `${y.first} to ${y.last}` : "no data"}, {s.indicators.length} indicator
                  {s.indicators.length === 1 ? "" : "s"}
                </span>
              </div>
              <div
                className="wiki-heat-cells wiki-srcbar-cells"
                style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
                role="img"
                aria-label={`${s.name} covers ${y?.first ?? "no"} to ${y?.last ?? "years"}`}
              >
                {(y?.share ?? []).map((v, i) => (
                  <span key={i} className="wiki-heat-cell" style={cssVars({ "--a": v.toFixed(3) })} />
                ))}
              </div>
            </div>
          );
        })}
        <div className="wiki-axis small" aria-hidden="true">
          <span>{meta.years[0]}</span>
          <span>{meta.years[Math.floor(n / 2)]}</span>
          <span>{meta.years[n - 1]}</span>
        </div>
      </div>
      <ShowAsTable
        caption="Years covered by each source"
        columns={["Source", "First year", "Last year", "Indicators"]}
        rows={SOURCES.map((s) => [s.name, yrs[s.id]?.first ?? null, yrs[s.id]?.last ?? null, s.indicators.length])}
      />
    </div>
  );
}
