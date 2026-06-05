import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { useDashboardData } from "../../state/dashboard-context";
import type { CountryPayload } from "../../data/contract/types";
import { displayOverall } from "../../data/contract/selectors";
import {
  derivationLabel,
  overallContext,
  pillarScoreContext,
  pillarScoreTooltip,
} from "../../data/contract/score-context";
import { NeedBadge } from "../../components/scores/ScoreWithContext";
import { TrendsPanel } from "./TrendsPanel";
import { EXPLORE_TABLE_FOOTNOTE, SCORE_INTERPRETATION_NOTE } from "../../content/data-notes";

const REG_COLORS: Record<string, string> = {
  afe: "#0079c1",
  afw: "#005d96",
  eap: "#b2cd5a",
  eca: "#7a9a1f",
  lcr: "#e07b35",
  mna: "#435d7f",
  sar: "#7a5a9a",
  nam: "#2a7a3a",
};

function trendDelta(trend: Array<number | null>): number | null {
  const vals = trend.filter((v): v is number => v != null);
  return vals.length >= 2 ? vals[vals.length - 1] - vals[0] : null;
}

function TrendLabel({ trend }: { trend: Array<number | null> }) {
  const d = trendDelta(trend);
  if (d == null) return <span className="trend-fl">—</span>;
  if (d > 3)  return <span className="trend-up">▲ Improving</span>;
  if (d < -3) return <span className="trend-dn">↓ Declining</span>;
  return <span className="trend-fl">→ Stable</span>;
}

function DomainBar({ val, color }: { val: number | null; color: string }) {
  if (val == null) return <span style={{ color: "var(--mut)" }}>—</span>;
  return (
    <div className="spark-wrap">
      <div className="spark-bg">
        <div className="spark-fill" style={{ width: `${val}%`, background: color }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#1e2a35", minWidth: 24, textAlign: "right" }}>
        {val}
      </span>
    </div>
  );
}

type SortDir = 1 | -1;

function cmpString(a: string, b: string, dir: SortDir) {
  return dir * (a < b ? -1 : a > b ? 1 : 0);
}

function cmpNumeric(a: number | null, b: number | null, dir: SortDir) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir * (b - a);
}

// Default column widths (px), matching the reference mock's fixed layout.
const DEFAULT_COL_W: Record<string, number> = { name: 120, region: 160, trend: 100, overall: 90 };
const DEFAULT_PILLAR_W = 100;
const MIN_COL_W = 60;

export function ExplorePage() {
  const { countries, meta, timeseries } = useDashboardData();
  const [activeRegion, setActiveRegion] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [sortCol, setSortCol] = useState<string>("health");
  const [sortDir, setSortDir] = useState<SortDir>(1);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  if (!meta) return null;

  const regionLabel = Object.fromEntries(meta.regions.map(r => [r.code, r.label]));

  function colW(colId: string) {
    return colWidths[colId] ?? DEFAULT_COL_W[colId] ?? DEFAULT_PILLAR_W;
  }

  // Drag-to-resize a column. Reads the live rendered width so the first drag
  // tracks correctly even before a width has been committed to state.
  function startResize(e: ReactMouseEvent, colId: string) {
    e.stopPropagation(); // don't trigger sort
    e.preventDefault();
    const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null;
    const startX = e.clientX;
    const startW = th ? th.offsetWidth : colW(colId);
    function doResize(ev: MouseEvent) {
      const newW = Math.max(MIN_COL_W, startW + (ev.clientX - startX));
      setColWidths(prev => ({ ...prev, [colId]: newW }));
    }
    function stopResize() {
      window.removeEventListener("mousemove", doResize);
      window.removeEventListener("mouseup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", doResize);
    window.addEventListener("mouseup", stopResize);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(1); }
  }

  function sortArrow(col: string) {
    if (sortCol !== col) return <span className="sort-arrow">⇅</span>;
    return sortDir === 1
      ? <span className="sort-arrow active">▼</span>
      : <span className="sort-arrow active">▲</span>;
  }

  function renderTh(colId: string, label: string) {
    return (
      <th
        key={colId}
        className="th-sort th-resizable"
        style={{ width: colW(colId), minWidth: MIN_COL_W }}
        onClick={() => handleSort(colId)}
      >
        {label} {sortArrow(colId)}
        <div className="col-resize" onMouseDown={e => startResize(e, colId)} onClick={e => e.stopPropagation()} />
      </th>
    );
  }

  function sortRows(rows: CountryPayload[]) {
    return [...rows].sort((a, b) => {
      if (sortCol === "name")    return cmpString(a.name, b.name, sortDir);
      if (sortCol === "region")  return cmpString(regionLabel[a.region] ?? a.region, regionLabel[b.region] ?? b.region, sortDir);
      if (sortCol === "overall") return cmpNumeric(displayOverall(a), displayOverall(b), sortDir);
      if (sortCol === "trend")   return cmpNumeric(trendDelta(a.trend), trendDelta(b.trend), sortDir);
      return cmpNumeric(a.scores[sortCol] ?? null, b.scores[sortCol] ?? null, sortDir);
    });
  }

  const needle = search.toLowerCase();
  const filtered = countries.filter(c =>
    (activeRegion === "all" || c.region === activeRegion) &&
    (needle === "" || c.name.toLowerCase().includes(needle))
  );
  const sorted = sortRows(filtered);

  const total = Math.max(filtered.length, 1);
  const regionCounts = meta.regions.map(r => ({
    ...r,
    count: filtered.filter(c => c.region === r.code).length,
  })).filter(r => r.count > 0);

  const n = meta.years.length;

  return (
    <section>
      <div className="hero">
        <h1>Country Development Indicators — Explore</h1>
        <p>Explore healthcare, agriculture, social infrastructure, and other indicators across PlanCatalyst countries.</p>
        <div className="hero-meta">
          <div><div className="hstat-num">{countries.length}</div><div className="hstat-lbl">Countries</div></div>
          <div><div className="hstat-num">{meta.indicators.length}</div><div className="hstat-lbl">Indicators</div></div>
          <div><div className="hstat-num">{meta.pillars.length}</div><div className="hstat-lbl">Pillars</div></div>
          <div><div className="hstat-num">{meta.years[0]}–{meta.years[n - 1]}</div><div className="hstat-lbl">Time range</div></div>
        </div>
      </div>
      <div className="fbar">
        <span className="fbar-lbl">Region</span>
        <button
          className={activeRegion === "all" ? "fbtn active" : "fbtn"}
          onClick={() => setActiveRegion("all")}
        >
          All
        </button>
        {meta.regions.map(r => (
          <button
            key={r.code}
            className={activeRegion === r.code ? "fbtn active" : "fbtn"}
            onClick={() => setActiveRegion(r.code)}
          >
            {r.label}
          </button>
        ))}
        <input
          className="fsearch"
          type="text"
          placeholder="Search country…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="ov-body">
        <div>
          <div className="card">
            <div className="card-title">Country indicator summary</div>
            <div className="ind-table-wrap">
              <table className="ind-table" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
                <thead>
                  <tr>
                    {renderTh("name", "Country")}
                    {renderTh("region", "Region")}
                    {renderTh("trend", "Trend")}
                    {renderTh("overall", "Overall")}
                    {meta.pillars.map(p => renderTh(p.key, p.label))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(c => (
                    <tr key={c.iso3}>
                      <td className="country-link">{c.name}</td>
                      <td>{regionLabel[c.region] ?? c.region}</td>
                      <td><TrendLabel trend={c.trend} /></td>
                      <td>
                        {(() => {
                          const oc = overallContext(c);
                          return (
                            <>
                              <DomainBar val={oc.value} color="#1e2a35" />
                              {oc.band && (
                                <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 2 }}>
                                  <NeedBadge band={oc.band} size={8.5} />
                                  {oc.source && (
                                    <span style={{ fontSize: 8, color: "var(--mut)", letterSpacing: ".3px" }}>
                                      {derivationLabel(oc.source)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </td>
                      {meta.pillars.map(p => {
                        const val = c.scores[p.key] ?? null;
                        const tip = val != null
                          ? pillarScoreTooltip(pillarScoreContext(c, p.key, timeseries, meta), p.label)
                          : `${p.label}: no published value in this snapshot`;
                        return (
                          <td key={p.key} title={tip}>
                            <DomainBar val={val} color={p.color} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(() => {
              const emptyPillars = meta.pillars.filter(p =>
                countries.every(c => (c.scores[p.key] ?? null) == null)
              );
              return (
                <p style={{ fontSize: 12, color: "var(--mut)", fontStyle: "italic", padding: "8px 14px 10px", margin: 0, lineHeight: 1.5 }}>
                  {EXPLORE_TABLE_FOOTNOTE}
                  {emptyPillars.length > 0 && (
                    <> {emptyPillars.map(p => p.label).join(", ")} {emptyPillars.length === 1 ? "has" : "have"} no data in this snapshot.</>
                  )}
                  {" "}{SCORE_INTERPRETATION_NOTE} Hover any pillar score for its coverage and confidence.
                </p>
              );
            })()}
          </div>
        </div>
        <div className="side-col">
          <div className="card">
            <div className="card-title">Countries by region</div>
            {regionCounts.map(r => (
              <div key={r.code} className="region-item">
                <span className="region-name">{r.label}</span>
                <div className="region-bar-bg">
                  <div
                    className="region-bar-fill"
                    style={{
                      width: `${Math.round(r.count / total * 100)}%`,
                      background: REG_COLORS[r.code] ?? "#0079c1",
                    }}
                  />
                </div>
                <span className="region-count">{r.count} countries</span>
              </div>
            ))}
          </div>
          <TrendsPanel filtered={filtered} regionLabel={regionLabel} />
        </div>
      </div>
    </section>
  );
}
