import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { CANDOUR, visibleDecisions, visibleIssues, type DecisionStatus } from "../../../../content/about";
import { Segmented } from "../../../../components/controls/Segmented";
import { Disclosure } from "../Disclosure";
import { StatusChip } from "../StatusChip";

type Filter = "all" | DecisionStatus;

/**
 * Every material pipeline decision. Filter by status; open a row to read what
 * we had to settle, what the dashboard does and why. Each row is the same
 * Disclosure as "The detail", so it eases open downward and nothing beside it
 * moves. Reads decisions.ts only.
 */
export function DecisionsLog() {
  const all = useMemo(() => visibleDecisions().slice().sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const count = (s: DecisionStatus) => all.filter((d) => d.status === s).length;
  const rows = filter === "all" ? all : all.filter((d) => d.status === filter);

  return (
    <div className="wiki-viz">
      <Segmented
        label="Filter decisions by status"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `All (${all.length})` },
          { value: "locked", label: `Locked (${count("locked")})` },
          { value: "pending", label: `Pending (${count("pending")})` },
          ...(CANDOUR === "hidden" ? [] : [{ value: "open" as const, label: `Open (${count("open")})` }]),
        ]}
      />
      <p className="small" aria-live="polite">
        {rows.length} decision{rows.length === 1 ? "" : "s"}
      </p>
      <div className="wiki-log-cols" aria-hidden="true">
        <span className="wiki-log-row">
          <span>Date</span>
          <span>Decision</span>
        </span>
        <span>Status</span>
        <span />
      </div>
      <div className="wiki-log">
        {rows.map((d) => {
          const issues = visibleIssues(d);
          return (
            <Disclosure
              key={d.id}
              className="wdisc--row"
              open={open[d.id] === true}
              onToggle={(o) => setOpen((m) => ({ ...m, [d.id]: o }))}
              title={
                <span className="wiki-log-row" id={`decision-${d.id}`}>
                  <span className="num small">{d.date}</span>
                  <span>{d.title}</span>
                </span>
              }
              meta={<StatusChip status={d.status} />}
            >
              <dl className="wiki-decision">
                <dt>What we had to settle</dt>
                <dd>{d.consideration}</dd>
                <dt>What the dashboard does</dt>
                <dd>{d.decision}</dd>
                <dt>Why</dt>
                <dd>{d.why}</dd>
                {issues.length ? (
                  <>
                    <dt>Issue</dt>
                    <dd>{issues.join(", ")}</dd>
                  </>
                ) : null}
                <dd>
                  <Link to={`/about/${d.section}`} className="wiki-xref">
                    Read the section
                  </Link>
                </dd>
              </dl>
            </Disclosure>
          );
        })}
      </div>
    </div>
  );
}
