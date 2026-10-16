import { STATUS_LABEL } from "../../../content/about";
import type { DecisionStatus } from "../../../content/about";

/** Locked, Pending client decision, Open issue. Labels come from decisions.ts. */
export function StatusChip({ status }: { status: DecisionStatus }) {
  return <span className={`chip wiki-status wiki-status--${status}`}>{STATUS_LABEL[status]}</span>;
}
