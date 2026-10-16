import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { CANDOUR, visibleDecisions, visibleIssues, type DecisionStatus } from "../../../../content/about";
import { Segmented } from "../../../../components/controls/Segmented";
import { StatusChip } from "../StatusChip";

type Filter = "all" | DecisionStatus;

/**
 * Every material pipeline decision. Filter by status; press a row to read what
 * had to be settled, what the dashboard does and why. Reads decisions.ts only.
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
      <div className="wiki-tablewrap">
        <table className="wiki-table wiki-table--log wiki-table--fixed">
          <caption>
            {rows.length} decision{rows.length === 1 ? "" : "s"}
          </caption>
          <colgroup>
            <col className="wiki-col-date" />
            <col />
            <col className="wiki-col-status" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Decision</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const isOpen = open[d.id] === true;
              const issues = visibleIssues(d);
              return (
                <tr key={d.id} id={`decision-${d.id}`}>
                  <td className="num wiki-nowrap">{d.date}</td>
                  <td>
                    <button
                      type="button"
                      className="wiki-rowbtn"
                      aria-expanded={isOpen}
                      onClick={() => setOpen((o) => ({ ...o, [d.id]: !isOpen }))}
                    >
                      {d.title}
                      <span className="wdisc-icon" aria-hidden="true" data-open={isOpen} />
                    </button>
                    {isOpen ? (
                      <dl className="wiki-decision">
                        <dt>What had to be settled</dt>
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
                    ) : null}
                  </td>
                  <td>
                    <StatusChip status={d.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
