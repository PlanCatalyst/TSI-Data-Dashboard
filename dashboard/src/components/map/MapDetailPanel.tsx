import { useMemo, useState } from "react";

import type {
  CountryPayload,
  MetaPayload,
  Pillar,
  ProjectionsPayload,
  TimeseriesPayload,
} from "../../data/contract/types";
import {
  computePillarTimeseries,
  computeSubdomainScores,
  groupIndicatorKeysByPillar,
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
import { SCORE_INTERPRETATION_NOTE_SHORT } from "../../content/data-notes";
import { OVERALL_SERIES_KEY, seriesColor } from "../scores/series-color";
import { useReveal } from "../../hooks/useReveal";
import { DomainTrendsChart } from "./DomainTrendsChart";
import { PanelHead } from "./PanelHead";
import { ScoreRow } from "./ScoreRow";
import { SubdomainBlock } from "./SubdomainBlock";

type Props = {
  country: CountryPayload | null;
  meta: MetaPayload;
  timeseries: TimeseriesPayload;
  projections?: ProjectionsPayload;
  regionLabel: Record<string, string>;
  onClose?: () => void;
  /** When true, panel takes ~75% of the map+panel viewport (desktop). */
  expanded?: boolean;
  onToggleExpand?: () => void;
};

function meanFinite(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

// Synthetic series head for the overall line. Not a contract pillar; the
// chart only needs key, label and colour.
const OVERALL_PILLAR: Pillar = {
  key: OVERALL_SERIES_KEY,
  label: "Overall index",
  color: seriesColor(OVERALL_SERIES_KEY),
  repIndicator: "",
};

export function MapDetailPanel({
  country,
  meta,
  timeseries,
  projections = [],
  regionLabel,
  onClose,
  expanded = false,
  onToggleExpand,
}: Props) {
  const projectionsEnabled = Boolean(meta.projections.enabled);
  const projectionIndex = useMemo(() => indexProjections(projections), [projections]);
  const allChartYears = useMemo(
    () => (projectionsEnabled ? chartYears(meta, projections) : meta.years),
    [meta, projections, projectionsEnabled],
  );

  // Which pillar row is open. One at a time; the chart follows it (REQ2.3).
  const [openPillar, setOpenPillar] = useState<string | null>(null);
  const [showAllSeries, setShowAllSeries] = useState(false);
  // Re-reveals head, rows, chart, breakdown in that order on each new country.
  const revealRef = useReveal<HTMLElement>(country?.iso3 ?? null);

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

  // Per-pillar historical means on meta.years, plus optional aggregated
  // forecast bands from indicator rows (mean of finite lo/hi only).
  const pillarSeries = useMemo(() => {
    const indsByPillar = groupIndicatorKeysByPillar(meta);
    return meta.pillars.map((p) => {
      const hist = pillarTimeseries[p.key] ?? meta.years.map(() => null);
      const histByYear = new Map(meta.years.map((y, i) => [y, hist[i] ?? null]));
      const data = allChartYears.map((y) => histByYear.get(y) ?? null);

      let bands: Array<{ lo: number; hi: number } | null> | undefined;
      let forecast: Array<number | null> | undefined;
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
        forecast = allChartYears.map((year) => {
          const values: number[] = [];
          for (const code of keys) {
            const band = forecastBand(getProjection(projectionIndex, country.iso3, code, year));
            if (band?.value != null) values.push(band.value);
          }
          return meanFinite(values);
        });
      }

      return { pillar: { ...p, color: seriesColor(p.key) }, data, bands, forecast };
    });
  }, [meta, pillarTimeseries, allChartYears, projectionsEnabled, country, projectionIndex]);

  // Overall line: per-year mean of whichever pillar means exist that year.
  // Mirrors displayOverall's fallback so the line and the headline agree in
  // spirit; null where no pillar has data.
  const overallSeries = useMemo(() => {
    const data = allChartYears.map((_, i) => {
      const vals = pillarSeries
        .map((s) => s.data[i])
        .filter((v): v is number => v != null);
      return meanFinite(vals);
    });
    return { pillar: OVERALL_PILLAR, data };
  }, [pillarSeries, allChartYears]);

  const chartSeries = useMemo(() => {
    if (showAllSeries) return [...pillarSeries, overallSeries];
    const focus = openPillar ? pillarSeries.find((s) => s.pillar.key === openPillar) : undefined;
    return focus ? [focus, overallSeries] : [overallSeries];
  }, [showAllSeries, openPillar, pillarSeries, overallSeries]);

  const anyUnavailable = useMemo(() => {
    if (!projectionsEnabled) return false;
    return Object.values(projectionViews).some((v) => v.hasUnavailable);
  }, [projectionViews, projectionsEnabled]);

  const panelClass = expanded ? "detail-panel is-expanded" : "detail-panel";

  if (!country) {
    return (
      <aside className={panelClass} aria-label="Country detail">
        <div className="dp-empty">
          <div className="state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} aria-hidden="true">
              <circle cx={12} cy={12} r={10} />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <p>Select a country on the map to see its scores and trends.</p>
          </div>
        </div>
      </aside>
    );
  }

  const overall = overallContext(country);
  const observedThrough = meta.years[meta.years.length - 1];
  const firstYear = meta.years[0] ?? null;
  const projectedThrough = allChartYears[allChartYears.length - 1] ?? observedThrough;
  const focusPillar = openPillar ? meta.pillars.find((p) => p.key === openPillar) : undefined;

  return (
    <aside ref={revealRef} className={panelClass} aria-label={`${country.name} detail`}>
      <PanelHead
        eyebrow={regionLabel[country.region] ?? country.region}
        title={country.name}
        overall={overall}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onClose={onClose}
      />

      <div className="panel-body">
        <section className="dp-section" aria-label="Pillar scores" data-reveal="1">
          <div className="score-rows">
            {meta.pillars.map((p) => (
              <ScoreRow
                key={p.key}
                pillar={p}
                ctx={pillarContexts[p.key]}
                delta={trendDelta(pillarTimeseries[p.key] ?? [])}
                firstYear={firstYear}
                expanded={openPillar === p.key}
                onToggle={() => setOpenPillar((cur) => (cur === p.key ? null : p.key))}
              />
            ))}
          </div>
        </section>

        <section className="dp-section" aria-label="Trend" data-reveal="2">
          <div className="sec">
            <span className="eyebrow">
              Trend{focusPillar ? `: ${focusPillar.label}` : ""}
            </span>
            <div className="dp-section-actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                aria-pressed={showAllSeries}
                onClick={() => setShowAllSeries((v) => !v)}
              >
                {showAllSeries ? "Focus" : "All pillars"}
              </button>
            </div>
          </div>
          <div className="trend-periods" aria-label="Chart data periods">
            <span className="trend-period">
              <span className="trend-period-line" aria-hidden="true" />
              Observed {firstYear} to {observedThrough}
            </span>
            {projectionsEnabled && meta.projections.firstProjectedYear != null && (
              <span className="trend-period trend-period--projected">
                <span className="trend-period-line" aria-hidden="true" />
                Projected {meta.projections.firstProjectedYear} to {projectedThrough}
              </span>
            )}
          </div>
          {projectionsEnabled && (
            <p className="projection-explainer">
              Solid lines are observed data. Dashed lines and shaded bands are model projections
              with 95% uncertainty. Forecasts currently cover eligible World Bank indicators.
            </p>
          )}
          <div className="draw" key={country.iso3}>
          <DomainTrendsChart
            years={allChartYears}
            series={chartSeries}
            projectionsDisabled={!projectionsEnabled}
            firstProjectedYear={meta.projections.firstProjectedYear}
          />
          </div>
          {!focusPillar && !showAllSeries && (
            <p className="chart-note">Open a pillar row to add it to the chart.</p>
          )}
          {projectionsEnabled && anyUnavailable && (
            <p className="chart-note">{UX_UNAVAILABLE_COPY}</p>
          )}
        </section>

        <section className="dp-section dp-section--breakdown" aria-label="Sub-domain breakdown" data-reveal="3">
          <div className="sec">
            <span className="eyebrow">Sub-domain breakdown</span>
          </div>
          <div className="dp-breakdown">
            {meta.pillars.map((p) => {
              const sds = meta.subdomains.filter((sd) => sd.pillar === p.key);
              if (sds.length === 0) return null;
              return (
                <details key={p.key} className="disc">
                  <summary>
                    <span className="summary-left">
                      <i className="stripe" style={{ background: seriesColor(p.key) }} aria-hidden="true" />
                      {p.label}
                      <span className="small">{sds.length} sub-domain{sds.length === 1 ? "" : "s"}</span>
                    </span>
                  </summary>
                  <div className="body sd-list">
                    {sds.map((sd) => (
                      <SubdomainBlock
                        key={sd.key}
                        subdomain={sd}
                        pillar={{ ...p, color: seriesColor(p.key) }}
                        score={subdomainScores[sd.key] ?? null}
                        indicators={meta.indicators}
                        timeseries={timeseries}
                        iso3={country.iso3}
                        years={meta.years}
                        projectionViews={projectionsEnabled ? projectionViews : undefined}
                        indicatorStatus={country.indicatorStatus}
                      />
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </div>

      <div className="src-note" data-reveal="4">
        Sources: {Array.from(new Set(meta.indicators.map((i) => i.source))).join(", ")}.
        {" "}{SCORE_INTERPRETATION_NOTE_SHORT} Generated{" "}
        {new Date(meta.generatedAt).toLocaleDateString()}.
      </div>
    </aside>
  );
}
