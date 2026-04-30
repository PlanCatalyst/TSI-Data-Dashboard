import { useDashboardData } from "../../state/dashboard-context";

export function AboutPage() {
  const { meta } = useDashboardData();

  return (
    <section>
      <h2>About</h2>
      <p>Contract metadata from `meta.json` is shown here.</p>
      <dl>
        <dt>Schema version</dt>
        <dd>{meta?.schemaVersion ?? "Not loaded"}</dd>
        <dt>Pipeline run ID</dt>
        <dd>{meta?.pipelineRunId ?? "Not loaded"}</dd>
        <dt>Generated at</dt>
        <dd>{meta?.generatedAt ?? "Not loaded"}</dd>
      </dl>
    </section>
  );
}
