import { useMemo, useState } from "react";

import { useDashboardData } from "../../state/dashboard-context";
import { MapDetailPanel } from "../../components/map/MapDetailPanel";
import { MAP_COLOR_STOPS, WorldChoropleth } from "../../components/map/WorldChoropleth";
import { displayOverall, getCountryByIso3 } from "../../data/contract/selectors";
import { SCORE_INTERPRETATION_NOTE_SHORT } from "../../content/data-notes";

export function MapPage() {
  const { meta, countries, timeseries, projections } = useDashboardData();
  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);

  // Hooks before any early return.
  const regionLabel = useMemo<Record<string, string>>(
    () => (meta ? Object.fromEntries(meta.regions.map((r) => [r.code, r.label])) : {}),
    [meta],
  );

  // Fixed colouring scheme: the mock's default "Overall index". `displayOverall`
  // prefers the contract's `country.overall` and falls back to the mean of
  // available pillar scores when that's null (the contract publishes null
  // whenever any pillar is null, which would leave the map mostly grey on
  // sparse data). Truly empty countries still come back as null → grey.
  const getScore = displayOverall;

  if (!meta) return null;

  const selectedCountry = selectedIso3 ? getCountryByIso3(countries, selectedIso3) ?? null : null;

  return (
    <section className="map-section">
      <div className="map-layout">
        <div className="map-area-wrap">
          <WorldChoropleth
            countries={countries}
            getScore={getScore}
            selectedIso3={selectedIso3}
            onSelect={(c) => setSelectedIso3(c ? c.iso3 : null)}
            regionLabel={regionLabel}
            pillars={meta.pillars}
          />

          {/* Legend overlay — anchored to the map area, matches the mock 1:1 */}
          <div className="map-overlay" style={{ minWidth: 160 }}>
            <div className="mov-title">Overall index</div>
            <div style={{ display: "flex", alignItems: "stretch", gap: 7, margin: "6px 0 4px" }}>
              <div
                style={{
                  width: 14,
                  borderRadius: 3,
                  background: `linear-gradient(to bottom, ${MAP_COLOR_STOPS.map((s) => s.color).join(", ")})`,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  fontSize: 9.5,
                  color: "var(--mut)",
                  lineHeight: 1.2,
                }}
              >
                {MAP_COLOR_STOPS.map((s, i) => (
                  <span
                    key={s.color}
                    style={{
                      fontWeight: i === 0 || i === MAP_COLOR_STOPS.length - 1 ? 600 : 400,
                      color: i === 0 || i === MAP_COLOR_STOPS.length - 1 ? "var(--txt)" : "var(--mut)",
                    }}
                  >
                    {s.labelEdge}
                  </span>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  fontSize: 9.5,
                  color: "var(--mut)",
                  lineHeight: 1.2,
                  paddingTop: 1,
                }}
              >
                {MAP_COLOR_STOPS.map((s) => (
                  <span key={s.label}>{s.label}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 9.5, color: "var(--mut)" }}>
              <div
                style={{
                  width: 14,
                  height: 10,
                  borderRadius: 2,
                  background: "#e8ecf0",
                  border: "1px solid #d0d5dc",
                  flexShrink: 0,
                }}
              />
              No data
            </div>
            <div style={{ marginTop: 7, fontSize: 9.5, color: "var(--mut)", lineHeight: 1.4 }}>
              Click to explore
              <br />
              Double-click to reset
            </div>
            <div style={{ marginTop: 7, paddingTop: 6, borderTop: "1px solid var(--bd)", fontSize: 9, color: "var(--mut)", lineHeight: 1.4 }}>
              {SCORE_INTERPRETATION_NOTE_SHORT}
            </div>
          </div>
        </div>

        <MapDetailPanel
          country={selectedCountry}
          meta={meta}
          timeseries={timeseries}
          projections={projections}
          regionLabel={regionLabel}
          onClose={() => setSelectedIso3(null)}
        />
      </div>
    </section>
  );
}
