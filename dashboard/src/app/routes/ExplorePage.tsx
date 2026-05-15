import { useState } from "react";
import { useDashboardData } from "../../state/dashboard-context";
import type { CountryPayload } from "../../data/contract/types";
import { TrendsPanel } from "./TrendsPanel";

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

export function ExplorePage() {
  const { countries, meta } = useDashboardData();
  const [activeRegion, setActiveRegion] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [sortCol, setSortCol] = useState<string>("health");
  const [sortDir, setSortDir] = useState<SortDir>(1);

  if (!meta) return null;

  const regionLabel = Object.fromEntries(meta.regions.map(r => [r.code, r.label]));

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

  function sortRows(rows: CountryPayload[]) {
    return [...rows].sort((a, b) => {
      if (sortCol === "name")    return cmpString(a.name, b.name, sortDir);
      if (sortCol === "region")  return cmpString(regionLabel[a.region] ?? a.region, regionLabel[b.region] ?? b.region, sortDir);
      if (sortCol === "overall") return cmpNumeric(a.overall, b.overall, sortDir);
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
            <div className="ind-table-wrap">
              <table className="ind-table">
                <thead>
                  <tr>
                    <th className="th-sort" onClick={() => handleSort("name")}>Country {sortArrow("name")}</th>
                    <th className="th-sort" onClick={() => handleSort("region")}>Region {sortArrow("region")}</th>
                    <th className="th-sort" onClick={() => handleSort("trend")}>Trend {sortArrow("trend")}</th>
                    <th className="th-sort" onClick={() => handleSort("overall")}>Overall {sortArrow("overall")}</th>
                    {meta.pillars.map(p => (
                      <th key={p.key} className="th-sort" onClick={() => handleSort(p.key)}>
                        {p.label} {sortArrow(p.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(c => (
                    <tr key={c.iso3}>
                      <td className="country-link">{c.name}</td>
                      <td>{regionLabel[c.region] ?? c.region}</td>
                      <td><TrendLabel trend={c.trend} /></td>
                      <td><DomainBar val={c.overall} color="#1e2a35" /></td>
                      {meta.pillars.map(p => (
                        <td key={p.key}>
                          <DomainBar val={c.scores[p.key] ?? null} color={p.color} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
