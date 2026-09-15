import { useMemo } from "react";

import type {
  CountryPayload,
  MetaPayload,
  ProjectionsPayload,
  TimeseriesPayload,
} from "../../data/contract/types";
import {
  computePillarTimeseries,
  computeSubdomainScores,
  groupIndicatorKeysByPillar,
  trendBucket,
  trendDelta,
} from "../../data/contract/selectors";
import {
  buildIndicatorProjectionView,
  chartYears,
  forecastBand,
  getProjection,
  indexProjections,
  UX_UNAVAILABLE_COPY,
} from "../../data/contract/projections";
import {
  overallContext,
  pillarScoreContext,
  type PillarScoreContext,
} from "../../data/contract/score-context";
import { ScoreWithContext } from "../scores/ScoreWithContext";
import { SCORE_INTERPRETATION_NOTE_SHORT } from "../../content/data-notes";
import { DomainTrendsChart } from "./DomainTrendsChart";
import { SubdomainBlock } from "./SubdomainBlock";

type Props = {
  country: CountryPayload | null;
  meta: MetaPayload;
  timeseries: TimeseriesPayload;
  projections?: ProjectionsPayload;
  regionLabel: Record<string, string>;
  onClose?: () => void;
};

function TrendChip({ delta }: { delta: number | null }) {
  const bucket = trendBucket(delta);
  if (bucket === "up") return <span style={{ color: "#2a7a3a" }}>▲ Improving</span>;
  if (bucket === "down") return <span style={{ color: "#c0392b" }}>↓ Declining</span>;
  if (bucket === "flat") return <span style={{ color: "#435d7f" }}>→ Stable</span>;
  return <span style={{ color: "var(--mut)" }}>—</span>;
}

function meanFinite(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function MapDetailPanel({
  country,
  meta,
  timeseries,
  projections = [],
  regionLabel,
  onClose,
}: Props) {
  const projectionsEnabled = Boolean(meta.projections.enabled);
  const projectionIndex = useMemo(() => indexProjections(projections), [projections]);
  const allChartYears = useMemo(
    () => (projectionsEnabled ? chartYears(meta, projections) : meta.years),
    [meta, projections, projectionsEnabled],
  );

  // Hooks must run unconditionally; pass `country` through but guard inside.
  const pillarTimeseries = useMemo<Record<string, Array<number | null>>>(
    () => (country ? computePillarTimeseries(country, timeseries, meta) : {}),
    [country, timeseries, meta],
  );
  const pillarContexts = useMemo<Record<string, PillarScoreContext>>(
    () =>
      country
        ? Object.fromEntries(
            meta.pillars.map((p) => [p.key, pillarScoreContext(country, p.key, timeseries, meta)]),
          )
        : {},
    [country, timeseries, meta],
  );
  const subdomainScores = useMemo<Record<string, number | null>>(
    () => (country ? computeSubdomainScores(country, timeseries, meta) : {}),
    [country, timeseries, meta],
  );

  const projectionViews = useMemo(() => {
    if (!country || !projectionsEnabled) return {} as Record<string, ReturnType<typeof buildIndicatorProjectionView>>;
    const out: Record<string, ReturnType<typeof buildIndicatorProjectionView>> = {};
    for (const ind of meta.indicators) {
      out[ind.key] = buildIndicatorProjectionView({
        meta,
        iso3: country.iso3,
        indicatorCode: ind.key,
        historicalSeries: timeseries[country.iso3]?.[ind.key],
        projectionIndex,
        years: allChartYears,
      });
    }
    return out;
  }, [country, meta, timeseries, projectionIndex, projectionsEnabled, allChartYears]);

  // Domain chart: historical pillar means on meta.years; optional aggregated
  // forecast bands from indicator §8 rows (mean of finite lo/hi only — never invent).
  const domainSeries = useMemo(() => {
    const indsByPillar = groupIndicatorKeysByPillar(meta);
    return meta.pillars.map((p) => {
      const hist = pillarTimeseries[p.key] ?? meta.years.map(() => null);
      const histByYear = new Map(meta.years.map((y, i) => [y, hist[i] ?? null]));
      const data = allChartYears.map((y) => histByYear.get(y) ?? null);

      let bands: Array<{ lo: number; hi: number } | null> | undefined;
      if (projectionsEnabled && country) {
        const keys = indsByPillar[p.key] ?? [];
        bands = allChartYears.map((year) => {
          const los: number[] = [];
          const his: number[] = [];
          for (const code of keys) {
            const band = forecastBand(getProjection(projectionIndex, country.iso3, code, year));
            if (band) {
              los.push(band.lo);
              his.push(band.hi);
            }
          }
          const lo = meanFinite(los);
          const hi = meanFinite(his);
          if (lo == null || hi == null) return null;
          return { lo, hi };
        });
      }

      return { pillar: p, data, bands };
    });
  }, [
    meta,
    pillarTimeseries,
    allChartYears,
    projectionsEnabled,
    country,
    projectionIndex,
  ]);

  const anyUnavailable = useMemo(() => {
    if (!projectionsEnabled) return false;
    return Object.values(projectionViews).some((v) => v.hasUnavailable);
  }, [projectionViews, projectionsEnabled]);

  // Empty state — shown when no country has been selected yet.
  if (!country) {
    return (
      <div className="detail-panel">
        <div className="dp-empty">
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#b2cd5a" strokeWidth={1.5}>
            <circle cx={12} cy={12} r={10} />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <p>Select a country on the map to explore its indicators and trends.</p>
        </div>
      </div>
    );
  }

  const overall = overallContext(country);
  const endYearLabel = allChartYears[allChartYears.length - 1] ?? meta.years[meta.years.length - 1];

  return (
    <div className="detail-panel">
      <div className="dp-hero" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{country.name}</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, opacity: 0.85 }}>
            {regionLabel[country.region] ?? country.region}
            {overall.value != null && (
              <>
                {" · "}
                <span style={{ fontWeight: 600 }}>
                  Overall {overall.estimated ? "~" : ""}{overall.value}
                </span>
                {overall.band && (
                  <span style={{ fontWeight: 600 }}> · {overall.band.label}</span>
                )}
                {overall.estimated && (
                  <span style={{ opacity: 0.8 }} title="No published overall score — mean of available pillar scores."> (partial)</span>
                )}
              </>
            )}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close country detail"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              borderRadius: 999,
              width: 28,
              height: 28,
              cursor: "pointer",
              fontSize: 14,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Pillar score grid — mock's 4+3 split. Robust to N != 7 pillars: */}
      {/* if more than 4, the first 4 sit on top and the rest fill row two. */}
      {(() => {
        const head = meta.pillars.slice(0, 4);
        const tail = meta.pillars.slice(4);
        const renderCell = (p: typeof meta.pillars[number]) => {
          const ctx = pillarContexts[p.key];
          const t = trendDelta(pillarTimeseries[p.key] ?? []);
          return (
            <div key={p.key} className="dp-sc">
              <div className="dp-sc-lbl">{p.label}</div>
              <ScoreWithContext
                value={ctx?.value ?? null}
                band={ctx?.band ?? null}
                source={ctx?.source ?? null}
                coverage={ctx?.coverage ?? null}
                estimated={ctx?.estimated ?? false}
                valueColor={p.color}
                valueSize={17}
                title={
                  ctx?.estimated
                    ? "Official pillar score unavailable — estimated from available indicators across all years."
                    : undefined
                }
              />
              <div className="dp-sc-trend">
                <TrendChip delta={t} />
              </div>
            </div>
          );
        };
        return (
          <>
            <div
              className="dp-scores"
              style={{ gridTemplateColumns: `repeat(${head.length}, 1fr)` }}
            >
              {head.map(renderCell)}
            </div>
            {tail.length > 0 && (
              <div
                className="dp-scores"
                style={{ gridTemplateColumns: `repeat(${tail.length}, 1fr)`, borderTop: "none" }}
              >
                {tail.map(renderCell)}
              </div>
            )}
          </>
        );
      })()}

      <div className="dp-sep" />
      <div className="dp-section">
        <div className="dp-section-title">
          Domain trends — {meta.years[0]} to {endYearLabel}
          {projectionsEnabled && (
            <span className="badge pred-badge">Projected</span>
          )}
          <span className="badge hist-badge">Historical</span>
        </div>
        <DomainTrendsChart
          years={allChartYears}
          series={domainSeries}
          projectionsDisabled={!projectionsEnabled}
          projectionsNote={meta.projections.note}
          firstProjectedYear={meta.projections.firstProjectedYear}
        />
        {projectionsEnabled && anyUnavailable && (
          <div style={{ fontSize: 11, color: "var(--mut)", fontStyle: "italic", marginTop: 6 }}>
            {UX_UNAVAILABLE_COPY}
          </div>
        )}
      </div>

      <div className="dp-sep" />
      <div className="dp-section">
        <div className="dp-section-title">
          Sub-domain breakdown
          <span style={{ fontSize: 10, color: "var(--mut)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
            click to expand indicators
          </span>
        </div>
        {meta.pillars.map((p) => {
          const sds = meta.subdomains.filter((sd) => sd.pillar === p.key);
          if (sds.length === 0) return null;
          return (
            <div key={p.key} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".4px",
                  color: "var(--mut)",
                  padding: "8px 0 6px",
                  borderBottom: `2px solid ${p.color}33`,
                  marginBottom: 6,
                }}
              >
                {p.label}
              </div>
              {sds.map((sd) => (
                <SubdomainBlock
                  key={sd.key}
                  subdomain={sd}
                  pillar={p}
                  score={subdomainScores[sd.key] ?? null}
                  indicators={meta.indicators}
                  timeseries={timeseries}
                  iso3={country.iso3}
                  years={meta.years}
                  projectionViews={projectionsEnabled ? projectionViews : undefined}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="src-note">
        Sources: {Array.from(new Set(meta.indicators.map((i) => i.source))).join(" · ")}.
        {" "}{SCORE_INTERPRETATION_NOTE_SHORT} Generated{" "}
        {new Date(meta.generatedAt).toLocaleDateString()}.
      </div>
    </div>
  );
}
