import { BRAZIL_CLIMATE } from "../../../../content/about/snapshot";
import { decisionById } from "../../../../content/about";
import { useDashboardData } from "../../../../state/dashboard-context";
import { LineChart, type Series } from "../charts";
import { ShowAsTable } from "../ShowAsTable";
import { StatusChip } from "../StatusChip";
import { snapshotNote } from "./data";

/**
 * Brazil's climate vulnerability under the retired clamp rule (cut off at 100)
 * and the soft floor now in effect (benchmark at 75, better countries spread
 * to 100). The values are static figures from one snapshot; the decision is
 * locked, so both lines show together rather than behind a toggle.
 */
export function FlatAt100() {
  const { meta } = useDashboardData();
  const c = BRAZIL_CLIMATE;
  const decision = decisionById("benchmark-rule");

  const clampSeries: Series = {
    id: "clamp",
    label: "Retired: cut off at 100",
    color: "var(--n-400)",
    dash: "5 4",
    width: 2,
    values: [...c.clamp],
  };
  const softSeries: Series = { id: "soft", label: "Live: soft floor", color: "var(--s-agri)", values: [...c.softFloor] };

  return (
    <div className="wiki-viz">
      {decision ? (
        <div className="wiki-viz-bar">
          <StatusChip status={decision.status} />
        </div>
      ) : null}
      <LineChart
        years={[...c.years]}
        series={[clampSeries, softSeries]}
        yMin={0}
        yMax={100}
        hLines={[{ value: 75, label: "benchmark = 75 under the soft floor" }]}
        ariaLabel="Brazil climate score by year, under the retired rule and the soft floor now live"
        format={(v) => String(Math.round(v * 10) / 10)}
      />
      <p className="small">
        Brazil, climate vulnerability, {c.years[0]} to {c.years[c.years.length - 1]}. The source value falls from{" "}
        {c.raw[0].toFixed(2)} to {c.raw[c.raw.length - 1].toFixed(2)}; the benchmark is {c.benchmark.toFixed(2)}, and
        lower is better.
      </p>
      <ShowAsTable
        caption="Brazil climate score by year"
        columns={["Year", "Vulnerability (source)", "Retired rule", "Soft floor (live)"]}
        rows={c.years.map((y, i) => [y, c.raw[i], c.clamp[i], c.softFloor[i]])}
        note={snapshotNote(meta)}
      />
    </div>
  );
}
