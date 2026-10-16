import { useState } from "react";

import { BRAZIL_CLIMATE } from "../../../../content/about/snapshot";
import { decisionById } from "../../../../content/about";
import { useDashboardData } from "../../../../state/dashboard-context";
import { LineChart, type Series } from "../charts";
import { Segmented } from "./Segmented";
import { ShowAsTable } from "../ShowAsTable";
import { StatusChip } from "../StatusChip";
import { snapshotNote } from "./data";

type Rule = "clamp" | "soft";

/**
 * Brazil's climate vulnerability under today's rule (cut off at 100) and the
 * proposed soft floor (benchmark at 75, better countries spread to 100). The
 * values are static figures from one snapshot; the status says it is awaiting
 * the client.
 */
export function FlatAt100() {
  const { meta } = useDashboardData();
  const [rule, setRule] = useState<Rule>("clamp");
  const c = BRAZIL_CLIMATE;
  const decision = decisionById("benchmark-rule");

  const clampSeries: Series = { id: "clamp", label: "Today: cut off at 100", color: "var(--pc-blue)", values: [...c.clamp] };
  const softSeries: Series = { id: "soft", label: "Proposed: soft floor", color: "var(--s-agri)", values: [...c.softFloor] };
  const series = rule === "clamp" ? [clampSeries] : [{ ...clampSeries, dash: "5 4", width: 2 }, softSeries];

  return (
    <div className="wiki-viz">
      <div className="wiki-viz-bar">
        <Segmented
          label="Scoring rule"
          value={rule}
          onChange={setRule}
          options={[
            { value: "clamp", label: "Current rule" },
            { value: "soft", label: "Proposed soft floor" },
          ]}
        />
        {decision ? <StatusChip status={decision.status} /> : null}
      </div>
      <LineChart
        years={[...c.years]}
        series={series}
        yMin={0}
        yMax={100}
        hLines={[{ value: 75, label: "benchmark = 75 under the soft floor" }]}
        ariaLabel="Brazil climate score by year, under the current rule and the proposed soft floor"
        format={(v) => String(Math.round(v * 10) / 10)}
      />
      <p className="small">
        Brazil, climate vulnerability, {c.years[0]} to {c.years[c.years.length - 1]}. The source value falls from{" "}
        {c.raw[0].toFixed(2)} to {c.raw[c.raw.length - 1].toFixed(2)}; the benchmark is {c.benchmark.toFixed(2)}, and
        lower is better.
      </p>
      <ShowAsTable
        caption="Brazil climate score by year"
        columns={["Year", "Vulnerability (source)", "Today", "Soft floor"]}
        rows={c.years.map((y, i) => [y, c.raw[i], c.clamp[i], c.softFloor[i]])}
        note={snapshotNote(meta)}
      />
    </div>
  );
}
