import { MethodologyTable } from "./MethodologyTable";
import { ScoringCurves } from "./ScoringCurves";

/** Section 4: the interactive curves, then the table of all indicators. */
export function ScoringVisual() {
  return (
    <div className="wiki-stack">
      <ScoringCurves />
      <div>
        <h4 className="wiki-subhead">All indicators</h4>
        <MethodologyTable />
      </div>
    </div>
  );
}
