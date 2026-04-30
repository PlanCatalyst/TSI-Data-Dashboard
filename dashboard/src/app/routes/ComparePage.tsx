import { EmptyState } from "../../components/states/EmptyState";

export function ComparePage() {
  return (
    <section>
      <h2>Compare</h2>
      <p>Multi-country comparison flows mount here.</p>
      <EmptyState title="No compare view wired yet" message="Connect comparison selectors next." />
    </section>
  );
}
