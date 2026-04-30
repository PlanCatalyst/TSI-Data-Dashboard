import { EmptyState } from "../../components/states/EmptyState";

export function ExplorePage() {
  return (
    <section>
      <h2>Explore</h2>
      <p>Country table, filters, and trend sparklines mount here.</p>
      <EmptyState title="No explore view wired yet" message="Connect countries selectors next." />
    </section>
  );
}
