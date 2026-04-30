import { EmptyState } from "../../components/states/EmptyState";

export function MapPage() {
  return (
    <section>
      <h2>Map</h2>
      <p>Choropleth and country drilldown mount here.</p>
      <EmptyState title="No map view wired yet" message="Connect map geometry and country scores next." />
    </section>
  );
}
