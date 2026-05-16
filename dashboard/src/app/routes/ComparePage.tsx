import { useState, useRef, useEffect } from "react";
import { useDashboardData } from "../../state/dashboard-context";
import type { CountryPayload } from "../../data/contract/types";

function DomainBar({ val, color }: { val: number | null; color: string }) {
  if (val == null) return <span style={{ color: "var(--mut)", fontSize: 11 }}>—</span>;
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

export function ComparePage() {
  const { countries, meta } = useDashboardData();
  const [activeRegion, setActiveRegion] = useState("all");
  const [activeDomain, setActiveDomain] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedISOs, setSelectedISOs] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!meta) return null;

  const regionLabel = Object.fromEntries(meta.regions.map(r => [r.code, r.label]));

  const filtered = countries.filter(c => activeRegion === "all" || c.region === activeRegion);
  const displayedPillars = activeDomain === "all"
    ? meta.pillars
    : meta.pillars.filter(p => p.key === activeDomain);

  const needle = searchQuery.toLowerCase();
  const dropdownItems = needle.length >= 1
    ? countries
        .filter(c => c.name.toLowerCase().includes(needle) && !selectedISOs.includes(c.iso3))
        .slice(0, 8)
    : [];

  const selectedCountries = countries.filter(c => selectedISOs.includes(c.iso3));

  function addCountry(iso3: string) {
    if (selectedISOs.length >= 5) return;
    setSelectedISOs(prev => [...prev, iso3]);
    setSearchQuery("");
    setShowDropdown(false);
  }

  function removeCountry(iso3: string) {
    setSelectedISOs(prev => prev.filter(x => x !== iso3));
  }

  return (
    <section>
      <div className="hero" style={{ padding: "18px 20px 16px" }}>
        <h1 style={{ fontSize: "clamp(15px, 2.5vw, 20px)" }}>Pillar Comparison — All Countries</h1>
        <p style={{ fontSize: "12.5px" }}>
          Each dot represents one country. Use filters to narrow the view. Select countries to compare side by side.
        </p>
      </div>

      {/* Region filter */}
      <div className="fbar">
        <span className="fbar-lbl">Region</span>
        <button className={activeRegion === "all" ? "fbtn active" : "fbtn"} onClick={() => setActiveRegion("all")}>All</button>
        {meta.regions.map(r => (
          <button key={r.code} className={activeRegion === r.code ? "fbtn active" : "fbtn"} onClick={() => setActiveRegion(r.code)}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Pillar filter */}
      <div className="fbar">
        <span className="fbar-lbl">Pillar</span>
        <button className={activeDomain === "all" ? "fbtn active" : "fbtn"} onClick={() => setActiveDomain("all")}>All</button>
        {meta.pillars.map(p => (
          <button key={p.key} className={activeDomain === p.key ? "fbtn active" : "fbtn"} onClick={() => setActiveDomain(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Country selector bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--bd)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="fbar-lbl">Compare countries</span>
        <div ref={searchRef} style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 280 }}>
          <input
            type="text"
            placeholder="Search and add country…"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => { if (searchQuery) setShowDropdown(true); }}
            style={{ width: "100%", padding: "5px 11px", border: "1px solid var(--bd)", borderRadius: 14, fontSize: 12, fontFamily: "inherit", outline: "none" }}
          />
          {showDropdown && dropdownItems.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid var(--bd)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.1)", zIndex: 200, maxHeight: 220, overflowY: "auto", fontSize: 12 }}>
              {dropdownItems.map(c => (
                <div
                  key={c.iso3}
                  className={selectedISOs.length >= 5 ? "cmp-dd-item disabled" : "cmp-dd-item"}
                  onMouseDown={() => { if (selectedISOs.length < 5) addCountry(c.iso3); }}
                >
                  {c.name}
                  <span style={{ color: "var(--mut)", fontSize: 11, marginLeft: 6 }}>{regionLabel[c.region] ?? c.region}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedCountries.map(c => (
            <span key={c.iso3} className="cmp-chip">
              {c.name}
              <button onClick={() => removeCountry(c.iso3)} aria-label={`Remove ${c.name}`}>×</button>
            </span>
          ))}
        </div>
        {selectedISOs.length > 0 && (
          <button
            onClick={() => setSelectedISOs([])}
            style={{ padding: "5px 10px", background: "none", border: "1px solid var(--bd)", borderRadius: 14, fontSize: 12, fontFamily: "inherit", cursor: "pointer", color: "var(--mut)", whiteSpace: "nowrap" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Comparison detail panel */}
      {selectedCountries.length > 0 && (
        <div style={{ background: "#f4f5f7", padding: "16px 20px 24px", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 12 }}>
            Selected country comparison
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {selectedCountries.map(c => (
              <div key={c.iso3} className="country-cmp-card">
                <div style={{ background: "var(--blue)", color: "#fff", padding: "10px 14px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{regionLabel[c.region] ?? c.region}</div>
                </div>
                <div style={{ padding: "8px 0 10px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", alignItems: "center", gap: 6, padding: "4px 12px" }}>
                    <span style={{ fontSize: 11, color: "var(--mut)" }}>Overall</span>
                    <DomainBar val={c.overall} color="#1e2a35" />
                  </div>
                  {meta.pillars.map(p => (
                    <div key={p.key} style={{ display: "grid", gridTemplateColumns: "80px 1fr", alignItems: "center", gap: 6, padding: "4px 12px" }}>
                      <span style={{ fontSize: 11, color: "var(--mut)" }}>{p.label}</span>
                      <DomainBar val={c.scores[p.key] ?? null} color={p.color} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strip charts */}
      <div className="cmp-body">
        {displayedPillars.map(p => {
          const vals = filtered
            .map(c => ({ c, v: c.scores[p.key] ?? null }))
            .filter((x): x is { c: CountryPayload; v: number } => x.v != null);
          const avg = vals.length ? Math.round(vals.reduce((s, x) => s + x.v, 0) / vals.length) : null;

          return (
            <div key={p.key} style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #f0f2f5", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 3, height: 16, background: p.color, borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--txt)" }}>{p.label}</span>
                <span style={{ fontSize: 11, color: "var(--mut)", marginLeft: "auto" }}>
                  {vals.length ? `${vals.length} countries` : "No data available"}
                </span>
              </div>
              <div style={{ padding: "12px 16px 28px" }}>
                {vals.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--mut)", fontStyle: "italic", padding: "8px 0" }}>
                    Data not yet available for this pillar.
                  </div>
                ) : (
                  <>
                    <div className="strip-axis-labels">
                      <div />
                      <div className="strip-axis-row">
                        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                      </div>
                    </div>
                    <div className="strip-chart">
                      <div className="strip-row">
                        <div className="strip-label">{p.label}</div>
                        <div className="strip-track">
                          <div className="strip-axis" />
                          {avg != null && (
                            <div className="strip-avg-line" style={{ left: `${avg}%` }}>
                              <div className="strip-avg-label">{avg}</div>
                            </div>
                          )}
                          {vals.map(({ c, v }) => (
                            <div
                              key={c.iso3}
                              className="strip-dot"
                              style={{ left: `${v}%`, background: p.color }}
                              title={`${c.name}: ${v}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
