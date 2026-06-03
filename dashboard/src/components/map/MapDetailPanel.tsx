import { useMemo } from "react";

import type {
  CountryPayload,
  MetaPayload,
  TimeseriesPayload,
} from "../../data/contract/types";
import {
  computeFallbackPillarScores,
  computePillarTimeseries,
  computeSubdomainScores,
  displayOverall,
  trendBucket,
  trendDelta,
} from "../../data/contract/selectors";
import { DomainTrendsChart } from "./DomainTrendsChart";
import { SubdomainBlock } from "./SubdomainBlock";

type Props = {
  country: CountryPayload | null;
  meta: MetaPayload;
  timeseries: TimeseriesPayload;
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

export function MapDetailPanel({
  country,
  meta,
  timeseries,
  regionLabel,
  onClose,
}: Props) {
  // Hooks must run unconditionally; pass `country` through but guard inside.
  const pillarTimeseries = useMemo<Record<string, Array<number | null>>>(
    () => (country ? computePillarTimeseries(country, timeseries, meta) : {}),
    [country, timeseries, meta],
  );
  const fallbackScores = useMemo<Record<string, number | null>>(
    () => (country ? computeFallbackPillarScores(country, timeseries, meta) : {}),
    [country, timeseries, meta],
  );
  const subdomainScores = useMemo<Record<string, number | null>>(
    () => (country ? computeSubdomainScores(country, timeseries, meta) : {}),
    [country, timeseries, meta],
  );

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

  // Re-bind so TS keeps the non-null narrowing across closures below.
  const c = country;

  // Final score per pillar: prefer the contract score, fall back to the
  // computed latest-non-null mean if the contract value is null. Keeps the
  // panel useful even when one pillar's most-recent year is sparse.
  function pillarScore(key: string): number | null {
    const direct = c.scores[key];
    if (direct != null) return direct;
    return fallbackScores[key] ?? null;
  }

  return (
    <div className="detail-panel">
      <div className="dp-hero" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{country.name}</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, opacity: 0.85 }}>
            {regionLabel[country.region] ?? country.region}
            {(() => {
              const overall = displayOverall(country);
              if (overall == null) return null;
              return (
                <>
                  {" · "}
                  <span style={{ fontWeight: 600 }}>Overall {overall}</span>
                </>
              );
            })()}
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
          const v = pillarScore(p.key);
          const t = trendDelta(pillarTimeseries[p.key] ?? []);
          return (
            <div key={p.key} className="dp-sc">
              <div className="dp-sc-lbl">{p.label}</div>
              <div className="dp-sc-val" style={{ color: p.color, fontSize: 17 }}>
                {v != null ? v : "—"}
              </div>
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
          Domain trends — {meta.years[0]} to {meta.years[meta.years.length - 1]}
          {meta.projections.enabled && (
            <span className="badge pred-badge">Projected</span>
          )}
          <span className="badge hist-badge">Historical</span>
        </div>
        <DomainTrendsChart
          years={meta.years}
          series={meta.pillars.map((p) => ({
            pillar: p,
            data: pillarTimeseries[p.key] ?? meta.years.map(() => null),
          }))}
          projectionsDisabled={!meta.projections.enabled}
          projectionsNote={meta.projections.note}
        />
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
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="src-note">
        Sources: {Array.from(new Set(meta.indicators.map((i) => i.source))).join(" · ")}.
        Index values 0–100, higher = more favourable. Generated{" "}
        {new Date(meta.generatedAt).toLocaleDateString()}.
      </div>
    </div>
  );
}
