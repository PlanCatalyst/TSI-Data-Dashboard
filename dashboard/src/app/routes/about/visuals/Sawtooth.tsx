import { useState } from "react";

import { BRAZIL_ABR } from "../../../../content/about/snapshot";
import { useDashboardData } from "../../../../state/dashboard-context";
import { LineChart, type Series } from "../charts";
import { Segmented } from "./Segmented";
import { ShowAsTable } from "../ShowAsTable";
import { snapshotNote } from "./data";

type View = "before" | "after";

/**
 * Brazil's adolescent births score. Before the one-row rule, each year took
 * whichever source row came first in the file: the 10 to 14 band (score 100)
 * or the 15 to 19 band (about 30). After it, only ages 15 to 19 are scored.
 */
export function Sawtooth() {
  const { meta } = useDashboardData();
  const [view, setView] = useState<View>("before");
  const d = BRAZIL_ABR;

  const before: Series = { id: "before", label: "Before: first row in the file", color: "var(--need-severe)", values: [...d.before], dots: true };
  const after: Series = { id: "after", label: "After: ages 15 to 19", color: "var(--pc-blue)", values: [...d.after], dots: true };

  return (
    <div className="wiki-viz">
      <Segmented
        label="Before or after the rule"
        value={view}
        onChange={setView}
        options={[
          { value: "before", label: "Before the rule" },
          { value: "after", label: "After the rule" },
        ]}
      />
      <LineChart
        years={[...d.years]}
        series={view === "before" ? [before] : [{ ...before, dash: "5 4", width: 1.5, dots: false }, after]}
        ariaLabel="Brazil adolescent births score by year, before and after choosing one source row"
      />
      <p className="small">
        {view === "before"
          ? "Even years came from the 10 to 14 band, about 3 births per 1,000, which scores 100. Odd years came from the 15 to 19 band, about 60 per 1,000, which scores about 30."
          : "One row per year, the 15 to 19 band the benchmark was written for. The line now follows the real decline."}
      </p>
      <ShowAsTable
        caption="Brazil adolescent births score by year"
        columns={["Year", "Row picked before", "Score before", "Score after"]}
        rows={d.years.map((y, i) => [y, d.bandBefore[i], d.before[i], d.after[i]])}
        note={snapshotNote(meta)}
      />
    </div>
  );
}
