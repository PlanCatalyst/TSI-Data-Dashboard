import { AUDIT } from "../../../../content/about/snapshot";
import { decisionById } from "../../../../content/about";
import { useDashboardData } from "../../../../state/dashboard-context";
import { ShowAsTable } from "../ShowAsTable";
import { StatusChip } from "../StatusChip";
import { snapshotNote } from "./data";

const nf = new Intl.NumberFormat("en-US");

/**
 * The audit result as one proportion bar, before and after the fixes, plus the
 * defects it found as status chips. Static figures, stamped with the snapshot.
 */
export function AuditBar() {
  const { meta } = useDashboardData();
  const { before, after } = AUDIT;
  const pct = (m: number, e: number) => (m / e) * 100;

  return (
    <div className="wiki-viz">
      <div className="wiki-audit-head">
        <div>
          <div className="wiki-big num">
            {nf.format(after.match)} <small>of {nf.format(after.expected)}</small>
          </div>
          <span className="small">scores match the independent rebuild after the fixes</span>
        </div>
        <div>
          <div className="wiki-big num">{AUDIT.before.mismatch}</div>
          <span className="small">scores that disagree</span>
        </div>
        <div>
          <div className="wiki-big num">{AUDIT.unexplainedDrops}</div>
          <span className="small">unexplained dropped rows</span>
        </div>
      </div>

      <div className="wiki-audit-bars">
        <div>
          <span className="small">Before the fixes</span>
          <div className="wiki-propbar" role="img" aria-label={`${nf.format(before.match)} of ${nf.format(before.expected)} match`}>
            <span style={{ width: `${pct(before.match, before.expected)}%`, background: "var(--need-low)" }} />
            <span style={{ width: `${100 - pct(before.match, before.expected)}%`, background: "var(--need-severe)" }} />
          </div>
          <span className="small num">
            {nf.format(before.match)} match, {before.missing} missing from the dashboard, {before.extra} shown without a valid source
          </span>
        </div>
        <div>
          <span className="small">After the fixes</span>
          <div className="wiki-propbar" role="img" aria-label={`${nf.format(after.match)} of ${nf.format(after.expected)} match`}>
            <span style={{ width: `${pct(after.match, after.expected)}%`, background: "var(--need-low)" }} />
          </div>
          <span className="small num">
            {nf.format(after.match)} match, {after.missing} missing, {after.extra} left (debt risk, waiting on the client)
          </span>
        </div>
      </div>

      <ul className="wiki-defects">
        {AUDIT.defects.map((d) => {
          const dec = decisionById(d.id);
          return (
            <li key={d.id}>
              {dec ? <StatusChip status={dec.status} /> : null}
              <span>{d.label}</span>
              <span className="small num">{d.rows} rows</span>
            </li>
          );
        })}
      </ul>
      <ShowAsTable
        caption="Audit result before and after the fixes"
        columns={["", "Expected", "Match", "Disagree", "Missing", "Extra"]}
        rows={[
          ["Before", before.expected, before.match, before.mismatch, before.missing, before.extra],
          ["After", after.expected, after.match, after.mismatch, after.missing, after.extra],
        ]}
        note={snapshotNote(meta)}
      />
    </div>
  );
}
