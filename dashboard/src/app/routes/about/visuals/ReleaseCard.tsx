import { CHANGELOG } from "../../../../content/about/snapshot";
import { formatTimestamp } from "../../../../data/formatters";
import { useDashboardData } from "../../../../state/dashboard-context";

/** Section 14: facts about the loaded snapshot, plus the short changelog. */
export function ReleaseCard() {
  const { meta, countries } = useDashboardData();
  if (!meta) return null;
  const facts: Array<[string, string]> = [
    ["Snapshot id", meta.pipelineRunId],
    ["Generated", formatTimestamp(meta.generatedAt)],
    ["Data format version", meta.schemaVersion],
    ["Countries", String(countries.length)],
    ["Indicators", String(meta.indicators.length)],
    ["Years", `${meta.years[0]} to ${meta.years[meta.years.length - 1]}`],
    ["Projections", meta.projections.enabled ? "On" : "Off"],
  ];
  return (
    <div className="wiki-viz wiki-release">
      <dl className="wiki-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="num">{v}</dd>
          </div>
        ))}
      </dl>
      <h4>What changed since the last release</h4>
      <ul className="wiki-changelog">
        {CHANGELOG.map((c) => (
          <li key={c.text}>
            <span className="num small">{c.date}</span>
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
