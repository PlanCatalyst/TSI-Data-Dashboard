import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";

import type { CountryPayload } from "../../data/contract/types";
import { displayOverall } from "../../data/contract/selectors";
import { LoadingState } from "../states/LoadingState";
import { ErrorState } from "../states/ErrorState";

// World atlas published by topojson; keys countries by numeric ISO id.
// Same source the mock loads — kept as a const so the URL is greppable.
const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const NO_DATA_FILL = "#dde2ea";
const SELECTED_STROKE = "#0079c1";
const DEFAULT_STROKE = "#fff";

// Five-bucket sequential palette from the mock; keep order high → low.
export const MAP_COLOR_STOPS = [
  { min: 80, color: "#1a4f72", label: "Very high", labelEdge: "80+" },
  { min: 65, color: "#0079c1", label: "High",      labelEdge: "65" },
  { min: 50, color: "#5aaed4", label: "Moderate",  labelEdge: "50" },
  { min: 35, color: "#a8d4e8", label: "Low",       labelEdge: "35" },
  { min: 0,  color: "#d4ebcf", label: "Very low",  labelEdge: "<35" },
] as const;

export function mapColor(score: number | null): string {
  if (score == null) return NO_DATA_FILL;
  for (const stop of MAP_COLOR_STOPS) {
    if (score >= stop.min) return stop.color;
  }
  return MAP_COLOR_STOPS[MAP_COLOR_STOPS.length - 1].color;
}

type CountryFeature = Feature<Geometry, { name?: string }> & { id?: string | number };

type Tooltip = {
  x: number;
  y: number;
  country: CountryPayload;
};

type Props = {
  countries: CountryPayload[];
  // Score used to colour each country; receives the country payload so callers
  // can pick any pillar score, the overall, or a derived value.
  getScore: (country: CountryPayload) => number | null;
  selectedIso3: string | null;
  onSelect: (country: CountryPayload | null) => void;
  // Optional region label lookup so the tooltip can show a friendly region.
  regionLabel?: Record<string, string>;
  // Pillar values shown in the tooltip body. Pass [] to hide them.
  pillars?: Array<{ key: string; label: string }>;
};

export function WorldChoropleth({
  countries,
  getScore,
  selectedIso3,
  onSelect,
  regionLabel = {},
  pillars = [],
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const pathFnRef = useRef<d3.GeoPath<unknown, d3.GeoPermissibleObjects> | null>(null);

  const [features, setFeatures] = useState<CountryFeature[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 520 });
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  // Index countries by numeric id for fast lookup during draw + interaction.
  const byNumericId = useMemo(() => {
    const out = new Map<number, CountryPayload>();
    for (const c of countries) out.set(c.id, c);
    return out;
  }, [countries]);

  // ── Load world geometry once ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetch(WORLD_ATLAS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`World atlas HTTP ${r.status}`);
        return r.json() as Promise<Topology>;
      })
      .then((topo) => {
        if (cancelled) return;
        const collection = topo.objects.countries as GeometryCollection;
        const fc = topojson.feature(topo, collection) as unknown as {
          features: CountryFeature[];
        };
        setFeatures(fc.features);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Track container size (responsive resize) ───────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function read() {
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(320, Math.round(rect.width));
      const h = Math.max(280, Math.round(rect.height));
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    }
    read();
    const ro = new ResizeObserver(read);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ── Draw / redraw on geometry, size or score change ────────────────────────
  useEffect(() => {
    if (!features || !svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    const { w: W, h: H } = size;

    const proj = d3.geoNaturalEarth1().scale(W / 6).translate([W / 2, H / 2]);
    const path = d3.geoPath(proj);
    pathFnRef.current = path;

    // Zoom behaviour — scroll/pinch to zoom, drag to pan.
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (ev) => {
        g.attr("transform", ev.transform.toString());
        // Keep stroke widths visually constant while zooming.
        g.selectAll<SVGPathElement, CountryFeature>("path.country")
          .attr("stroke-width", 0.5 / ev.transform.k);
        g.selectAll<SVGPathElement, CountryFeature>("path.country.selected")
          .attr("stroke-width", 2 / ev.transform.k);
      });
    zoomRef.current = zoom;
    svg.call(zoom);
    svg.on("dblclick.zoom", null);
    svg.on("dblclick", () => {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      onSelect(null);
    });

    // Bind data and draw paths (replace, not enter+update — features are stable
    // but score-driven fills change frequently; cheap to redraw at ~180 paths).
    const sel = g
      .selectAll<SVGPathElement, CountryFeature>("path.country")
      .data(features, (d) => String((d as CountryFeature).id ?? ""));
    sel.exit().remove();
    const merged = sel
      .enter()
      .append("path")
      .attr("class", "country")
      .merge(sel)
      .attr("d", (d) => path(d as d3.GeoPermissibleObjects) ?? "")
      .attr("stroke", DEFAULT_STROKE)
      .attr("stroke-width", 0.5)
      .style("cursor", (d) => (byNumericId.has(Number(d.id)) ? "pointer" : "default"))
      .attr("fill", (d) => {
        const c = byNumericId.get(Number(d.id));
        return c ? mapColor(getScore(c)) : NO_DATA_FILL;
      });

    merged.classed("selected", (d) => {
      const c = byNumericId.get(Number(d.id));
      return !!c && c.iso3 === selectedIso3;
    });
    merged
      .filter(function () {
        return d3.select(this).classed("selected");
      })
      .attr("stroke", SELECTED_STROKE)
      .attr("stroke-width", 2);

    merged
      .on("mousemove", function (ev: MouseEvent, d) {
        const c = byNumericId.get(Number(d.id));
        if (!c) {
          setTooltip(null);
          return;
        }
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        setTooltip({
          x: ev.clientX - rect.left + 14,
          y: ev.clientY - rect.top - 8,
          country: c,
        });
      })
      .on("mouseleave", () => setTooltip(null))
      .on("click", function (ev: MouseEvent, d) {
        const c = byNumericId.get(Number(d.id));
        if (!c) return;
        ev.stopPropagation();
        onSelect(c);

        // Zoom into selected country bounds — capped at 5x so small countries
        // don't blow up to mosh-pit pixel scale.
        const bounds = path.bounds(d as d3.GeoPermissibleObjects);
        const bW = bounds[1][0] - bounds[0][0];
        const bH = bounds[1][1] - bounds[0][1];
        const midX = (bounds[0][0] + bounds[1][0]) / 2;
        const midY = (bounds[0][1] + bounds[1][1]) / 2;
        const scale = Math.min(5, 0.55 / Math.max(bW / W, bH / H));
        const tx = W / 2 - scale * midX;
        const ty = H / 2 - scale * midY;
        svg
          .transition()
          .duration(600)
          .ease(d3.easeCubicInOut)
          .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      });

    // Cleanup: detach zoom listeners when deps change so we don't double-bind.
    return () => {
      svg.on(".zoom", null);
      svg.on("dblclick", null);
    };
  }, [features, size, byNumericId, getScore, selectedIso3, onSelect]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="map-area" ref={wrapRef}>
        <div style={{ padding: 24 }}>
          <ErrorState
            message={`Could not load world map geometry: ${loadError}`}
            onRetry={() => {
              setLoadError(null);
              setFeatures(null);
              // Trigger refetch by re-running the load effect via a no-op state
              // change; cheapest way is to remount via key, so callers can do
              // that. Here we just retry inline.
              fetch(WORLD_ATLAS_URL)
                .then((r) => r.json() as Promise<Topology>)
                .then((topo) => {
                  const collection = topo.objects.countries as GeometryCollection;
                  const fc = topojson.feature(topo, collection) as unknown as {
                    features: CountryFeature[];
                  };
                  setFeatures(fc.features);
                })
                .catch((err: unknown) =>
                  setLoadError(err instanceof Error ? err.message : String(err)),
                );
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="map-area" ref={wrapRef}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}
        role="img"
        aria-label="Choropleth world map of country development scores"
      >
        <g ref={gRef} />
      </svg>

      {!features && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <LoadingState message="Loading map…" />
        </div>
      )}

      {tooltip && (
        <div
          className="map-tip"
          style={{ display: "block", left: tooltip.x, top: tooltip.y, position: "absolute" }}
        >
          <strong>{tooltip.country.name}</strong>
          <div className="tip-row">
            <span>Overall</span>
            <span>{displayOverall(tooltip.country) ?? "—"}</span>
          </div>
          {pillars.map((p) => (
            <div key={p.key} className="tip-row">
              <span>{p.label}</span>
              <span>{tooltip.country.scores[p.key] ?? "—"}</span>
            </div>
          ))}
          <div className="tip-row">
            <span>Region</span>
            <span>{regionLabel[tooltip.country.region] ?? tooltip.country.region}</span>
          </div>
        </div>
      )}
    </div>
  );
}
