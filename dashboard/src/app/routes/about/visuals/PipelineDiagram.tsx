import { useState } from "react";

import { STAGES } from "../../../../content/about/s03-source-to-screen";
import { TB_RECORD } from "../../../../content/about/snapshot";
import { useDashboardData } from "../../../../state/dashboard-context";
import { ShowAsTable } from "../ShowAsTable";
import { snapshotNote } from "./data";

/** What the example record holds after each stage, in the order of STAGES. */
const RECORD_VALUE = [
  `${TB_RECORD.value.toFixed(1)} per 100,000`,
  `${TB_RECORD.value.toFixed(1)} per 100,000`,
  `${TB_RECORD.value.toFixed(1)} per 100,000`,
  `${TB_RECORD.value.toFixed(1)} per 100,000`,
  `need ${TB_RECORD.need.toFixed(1)}`,
  `need ${TB_RECORD.need.toFixed(1)}, passed`,
  `score ${TB_RECORD.published.toFixed(1)}`,
];

/**
 * The seven stages as a row. Press a stage to see what it does and what
 * happens to one real record there: Brazil, tuberculosis, 2024.
 */
export function PipelineDiagram() {
  const { meta, timeseries } = useDashboardData();
  const [i, setI] = useState(0);
  const stage = STAGES[i];

  const live = meta ? timeseries[TB_RECORD.iso3]?.[TB_RECORD.indicator]?.[meta.years.indexOf(TB_RECORD.year)] ?? null : null;
  const note = snapshotNote(meta);

  return (
    <div className="wiki-viz">
      <p className="small wiki-viz-lead">
        Follow one record: Brazil, tuberculosis incidence, {TB_RECORD.year}. Press a stage.
      </p>
      <ol className="wiki-stages" aria-label="Pipeline stages">
        {STAGES.map((s, k) => (
          <li key={s.id} className="wiki-stage-item" data-done={k <= i}>
            <button
              type="button"
              className="wiki-stage"
              aria-current={k === i ? "step" : undefined}
              aria-pressed={k === i}
              onClick={() => setI(k)}
            >
              <span className="wiki-stage-n num">{k + 1}</span>
              <span className="wiki-stage-name">{s.name}</span>
              <span className="wiki-stage-val num">{RECORD_VALUE[k]}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="wiki-stage-detail" aria-live="polite">
        <p>
          <b>
            {i + 1}. {stage.name}.
          </b>{" "}
          {stage.does}
        </p>
        <p className="wiki-stage-record">{stage.record}</p>
        {i === STAGES.length - 1 ? (
          <p className="small">
            Published value now in the data: <b className="num">{live == null ? "no data" : live}</b>
            {live != null && Math.abs(live - TB_RECORD.published) > 0.05 ? " (the data has been refreshed since this example was taken)" : ""}
          </p>
        ) : null}
      </div>
      <ShowAsTable
        caption="One record through the seven stages"
        columns={["Stage", "What happens", "The record"]}
        rows={STAGES.map((s, k) => [s.name, s.does, RECORD_VALUE[k]])}
        note={note}
      />
    </div>
  );
}
