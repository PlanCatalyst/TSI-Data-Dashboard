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

  return (
    <section>
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
                      <td>{c.overall ?? "—"}</td>
                      {meta.pillars.map(p => (
                        <td key={p.key}>{c.scores[p.key] ?? "—"}</td>
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
