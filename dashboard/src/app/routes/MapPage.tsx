import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";


import { useDashboardData } from "../../state/dashboard-context";
import { MapDetailPanel } from "../../components/map/MapDetailPanel";
import { MAP_COLOR_STOPS, WorldChoropleth } from "../../components/map/WorldChoropleth";
import { displayOverall, getCountryByIso3 } from "../../data/contract/selectors";
import { SCORE_INTERPRETATION_NOTE_SHORT } from "../../content/data-notes";
import { WhyLink } from "../../components/scores/WhyLink";

export function MapPage() {
  const { meta, countries, timeseries, projections } = useDashboardData();
  // #/map?country=BRA opens that country's panel. The About page links here.
  const [params] = useSearchParams();
  const requested = params.get("country")?.toUpperCase() ?? null;
  const requestedValid = requested !== null && countries.some((c) => c.iso3 === requested);
  const [selectedIso3, setSelectedIso3] = useState<string | null>(requestedValid ? requested : null);
  useEffect(() => {
    if (requestedValid) setSelectedIso3(requested);
  }, [requested, requestedValid]);
  // Expand widens the detail panel to 75%; collapse restores the default
  // width (the panel stays visible, this is not dismiss). The expanded
  // state only has meaning while a country is selected, so it is derived
  // below and reset on close (requirements v2, bug B1).
  const [wantExpanded, setWantExpanded] = useState(false);
  const panelExpanded = wantExpanded && selectedIso3 !== null;

  const closePanel = () => {
    setSelectedIso3(null);
    setWantExpanded(false);
  };

  // Hooks before any early return.
  const regionLabel = useMemo<Record<string, string>>(
    () => (meta ? Object.fromEntries(meta.regions.map((r) => [r.code, r.label])) : {}),
    [meta],
  );

  // Fixed colouring scheme: the mock's default "Overall index". A country
  // missing any pillar has a null overall and stays in the no-data colour.
  const getScore = displayOverall;

  if (!meta) return null;

  const selectedCountry = selectedIso3 ? getCountryByIso3(countries, selectedIso3) ?? null : null;

  return (
    <section className="map-section">
      <div className={`map-layout${panelExpanded ? " panel-expanded" : ""}`}>
        <div className="map-area-wrap">
          <WorldChoropleth
            countries={countries}
            getScore={getScore}
            selectedIso3={selectedIso3}
            onSelect={(c) => (c ? setSelectedIso3(c.iso3) : closePanel())}
            regionLabel={regionLabel}
            pillars={meta.pillars}
          />

          {/* Legend: design system .legend, anchored inside the map area. */}
          <div className="legend map-legend" aria-label="Map legend">
            <span className="eyebrow">Overall index</span>
            <div className="legend-ramp">
              {MAP_COLOR_STOPS.map((s) => (
                <div key={s.label} className="row">
                  <i style={{ background: s.color }} aria-hidden="true" />
                  <span>{s.label}</span>
                  <span className="small">{s.labelEdge}</span>
                </div>
              ))}
              <div className="row">
                <i style={{ background: "var(--map-null)" }} aria-hidden="true" />
                <span>No data</span>
                <span />
              </div>
            </div>
            <p className="small legend-help">Click a country to explore. Double-click to reset.</p>
            <p className="small legend-note">
              {SCORE_INTERPRETATION_NOTE_SHORT} <WhyLink to="flat-at-100" />
            </p>
          </div>
        </div>

        <MapDetailPanel
          country={selectedCountry}
          meta={meta}
          timeseries={timeseries}
          projections={projections}
          regionLabel={regionLabel}
          onClose={closePanel}
          expanded={panelExpanded}
          onToggleExpand={() => setWantExpanded((v) => !v)}
        />
      </div>
    </section>
  );
}
