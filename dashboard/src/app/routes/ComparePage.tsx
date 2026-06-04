import { useState, useRef, useEffect, useMemo } from "react";
import { useDashboardData } from "../../state/dashboard-context";
import type { CountryPayload, Pillar } from "../../data/contract/types";
import { displayOverall } from "../../data/contract/selectors";
import { deferredNoteForIndicators, NO_DATA_FOR_SELECTION } from "../../content/data-notes";

const COUNTRY_PALETTE = ["#0079c1", "#e07b35", "#2a7a3a", "#7a5a9a", "#c0392b"];

function PillarTrendChart({
  pillar, series, years, note,
}: {
  pillar: Pillar;
  series: { iso3: string; name: string; color: string; data: (number | null)[] }[];
  years: number[];
  note?: string | null;
}) {
  const [dotTip, setDotTip] = useState<{ x: number; y: number; yearIdx: number } | null>(null);

  // No country in the current selection has a single non-null point for this
  // pillar — render an explicit, honest empty state instead of a bare grid that
  // reads as "all zero".
  const hasData = series.some(s => s.data.some(v => v != null));
  if (!hasData) {
    return (
      <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 8, padding: "10px 12px", minHeight: 130, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: pillar.color, marginBottom: 6 }}>{pillar.label}</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--mut)", fontSize: 11, fontStyle: "italic", lineHeight: 1.45, padding: "4px 6px" }}>
          {note ?? NO_DATA_FOR_SELECTION}
        </div>
      </div>
    );
  }

  const W = 280, H = 110;
  const PAD = { t: 8, b: 24, l: 28, r: 8 };
  const trackW = W - PAD.l - PAD.r;
  const n = years.length;
  const xS = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * trackW : trackW / 2);
  const yS = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);
  const labelIndices = n <= 6
    ? Array.from({ length: n }, (_, i) => i)
    : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];

  return (
    <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 8, padding: "10px 12px" }}
      onMouseLeave={() => setDotTip(null)}>
      <div style={{ fontSize: 11, fontWeight: 700, color: pillar.color, marginBottom: 6 }}>{pillar.label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: H, overflow: "visible" }}>
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={PAD.l} y1={yS(v)} x2={W - PAD.r} y2={yS(v)} stroke="#eef0f3" strokeWidth="1" />
            <text x={PAD.l - 4} y={yS(v) + 3.5} textAnchor="end" fontSize="9" fill="#b0b8c2">{v}</text>
          </g>
        ))}
        {labelIndices.map(i => (
          <text key={i} x={xS(i)} y={H - PAD.b + 11} textAnchor="middle" fontSize="9" fill="#9aa4ae">
            {years[i]}
          </text>
        ))}
        {series.map(s => {
          const pts = s.data
            .map((v, i) => v != null ? `${xS(i).toFixed(1)},${yS(v).toFixed(1)}` : null)
            .filter(Boolean).join(" ");
          return (
            <g key={s.iso3}>
              {pts && (
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              )}
              {s.data.map((v, i) => v == null ? null : (
                <circle
                  key={i}
                  cx={xS(i).toFixed(1)} cy={yS(v).toFixed(1)} r="3"
                  fill={s.color} style={{ cursor: "pointer" }}
                  onMouseEnter={e => {
                    const r = (e.currentTarget as SVGCircleElement).getBoundingClientRect();
                    setDotTip({ x: r.left + r.width / 2, y: r.top, yearIdx: i });
                  }}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {dotTip && (
        <div style={{
          position: "fixed", left: dotTip.x, top: dotTip.y - 8,
          transform: "translate(-50%, -100%)",
          background: "#1e2a35", color: "#fff",
          padding: "8px 12px", borderRadius: 7, fontSize: 12,
          pointerEvents: "none", zIndex: 9999,
          boxShadow: "0 2px 12px rgba(0,0,0,.3)",
          minWidth: 130, lineHeight: 1.5,
        }}>
          <strong style={{ display: "block", marginBottom: 4 }}>{years[dotTip.yearIdx]}</strong>
          {series.map(s => (
            <div key={s.iso3} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
              <span>{s.name}:</span>
              <span style={{ fontWeight: 700, marginLeft: "auto" }}>
                {s.data[dotTip.yearIdx] != null ? s.data[dotTip.yearIdx] : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const { countries, meta, timeseries } = useDashboardData();
  const [activeRegion, setActiveRegion] = useState("all");
  const [activeDomain, setActiveDomain] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedISOs, setSelectedISOs] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; countries: string[] } | null>(null);
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

  const filtered = countries.filter(c => activeRegion === "all" || c.region === activeRegion);

  // Indicator-key lookups used to attach data-honesty notes (deferred vs. simply
  // absent from this snapshot) to pillars/subdomains that come back empty.
  const indKeysByPillar = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const ind of meta?.indicators ?? []) (out[ind.pillar] ??= []).push(ind.key);
    return out;
  }, [meta]);
  const indKeysBySubdomain = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const ind of meta?.indicators ?? []) (out[ind.subdomain] ??= []).push(ind.key);
    return out;
  }, [meta]);

  // Per-year pillar averages computed from all that pillar's indicator timeseries.
  // Used for trend charts to show year-by-year progression.
  const pillarTimeseries = useMemo(() => {
    if (!meta) return {} as Record<string, Record<string, Array<number | null>>>;
    const indsByPillar: Record<string, string[]> = {};
    for (const ind of meta.indicators) {
      (indsByPillar[ind.pillar] ??= []).push(ind.key);
    }
    const result: Record<string, Record<string, Array<number | null>>> = {};
    for (const c of countries) {
      result[c.iso3] = {};
      for (const p of meta.pillars) {
        const keys = indsByPillar[p.key] ?? [];
        result[c.iso3][p.key] = meta.years.map((_, yi) => {
          const vals = keys
            .map(k => (timeseries[c.iso3]?.[k] ?? [])[yi] ?? null)
            .filter((v): v is number => v != null);
          return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        });
      }
    }
    return result;
  }, [countries, meta, timeseries]);

  // Subdomain scores derived from latest non-null timeseries value per indicator, averaged per subdomain
  const sdScores = useMemo(() => {
    if (!meta) return {} as Record<string, Record<string, number | null>>;
    const indsBySubdomain: Record<string, string[]> = {};
    for (const ind of meta.indicators) {
      (indsBySubdomain[ind.subdomain] ??= []).push(ind.key);
    }
    const result: Record<string, Record<string, number | null>> = {};
    for (const c of filtered) {
      result[c.iso3] = {};
      for (const sd of meta.subdomains) {
        const keys = indsBySubdomain[sd.key] ?? [];
        const vals = keys
          .map(k => (timeseries[c.iso3]?.[k] ?? []).reduceRight<number | null>((acc, v) => acc ?? v, null))
          .filter((v): v is number => v != null);
        result[c.iso3][sd.key] = vals.length
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : null;
      }
    }
    return result;
  }, [filtered, meta, timeseries]);

  if (!meta) return null;

  const regionLabel = Object.fromEntries(meta.regions.map(r => [r.code, r.label]));
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
                    <DomainBar val={displayOverall(c)} color="#1e2a35" />
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

          <p style={{ marginTop: 12, fontSize: 11, color: "var(--mut)", lineHeight: 1.5, maxWidth: 760 }}>
            Pillar summary scores above show published values, available once a country has
            sufficient indicator coverage. The trends and sub-domain breakdown below include
            every available indicator, so some detail may appear for pillars that do not yet
            have a published summary score. Blank values are missing data, never zero.
          </p>

          {/* Trend charts */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 10 }}>
              Score trends by pillar
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {meta.pillars.map(p => {
                const series = selectedCountries.map((c, ci) => ({
                  iso3: c.iso3,
                  name: c.name,
                  color: COUNTRY_PALETTE[ci % COUNTRY_PALETTE.length],
                  data: pillarTimeseries[c.iso3]?.[p.key] ?? meta.years.map(() => null),
                }));
                const note = deferredNoteForIndicators(indKeysByPillar[p.key] ?? []);
                return <PillarTrendChart key={p.key} pillar={p} series={series} years={meta.years} note={note} />;
              })}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 11, color: "var(--mut)" }}>
              {selectedCountries.map((c, ci) => (
                <span key={c.iso3} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 16, height: 2, background: COUNTRY_PALETTE[ci % COUNTRY_PALETTE.length], display: "inline-block" }} />
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-domain breakdown (comparison) or density strip charts (all countries) */}
      {selectedCountries.length > 0 ? (
        <div className="cmp-body">
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 12, paddingTop: 4 }}>
            Sub-domain breakdown
          </div>
          {displayedPillars.map(p => {
            const pillarSubdomains = meta.subdomains.filter(sd => sd.pillar === p.key);
            const pillarHasData = pillarSubdomains.some(sd =>
              selectedCountries.some(c => sdScores[c.iso3]?.[sd.key] != null)
            );
            const emptyNote = deferredNoteForIndicators(indKeysByPillar[p.key] ?? []) ?? NO_DATA_FOR_SELECTION;
            return (
              <div key={p.key} style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 4, height: 18, background: p.color, borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--txt)" }}>{p.label}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
                    {selectedCountries.map((c, ci) => (
                      <span key={c.iso3} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: COUNTRY_PALETTE[ci % COUNTRY_PALETTE.length], display: "inline-block", flexShrink: 0 }} />
                        <span style={{ color: COUNTRY_PALETTE[ci % COUNTRY_PALETTE.length], fontWeight: 700 }}>{c.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
                {!pillarHasData && (
                  <div style={{ padding: "10px 16px", fontSize: 11.5, color: "var(--mut)", fontStyle: "italic", lineHeight: 1.5, borderBottom: pillarSubdomains.length ? "1px solid #f3f4f6" : "none", background: "#fafbfc" }}>
                    {emptyNote}
                  </div>
                )}
                <div>
                  {pillarSubdomains.length === 0 ? (
                    <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--mut)", fontStyle: "italic" }}>
                      No sub-domains defined for this pillar.
                    </div>
                  ) : pillarSubdomains.map((sd, sdIdx) => {
                    const sdHasData = selectedCountries.some(c => sdScores[c.iso3]?.[sd.key] != null);
                    const sdDeferred = !sdHasData ? deferredNoteForIndicators(indKeysBySubdomain[sd.key] ?? []) : null;
                    return (
                    <div
                      key={sd.key}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "9px 16px",
                        borderBottom: sdIdx < pillarSubdomains.length - 1 ? "1px solid #f3f4f6" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 170px", minWidth: 0 }}
                        title={sdDeferred ?? undefined}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--txt)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {sd.label}{sdDeferred ? " ⓘ" : ""}
                        </span>
                      </div>
                      <div style={{ flex: 1, display: "flex", gap: 16 }}>
                        {selectedCountries.map((c, ci) => {
                          const val = sdScores[c.iso3]?.[sd.key] ?? null;
                          const col = COUNTRY_PALETTE[ci % COUNTRY_PALETTE.length];
                          return (
                            <div key={c.iso3} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 5, background: "#eef0f3", borderRadius: 3, overflow: "hidden" }}>
                                {val != null && (
                                  <div style={{ width: `${val}%`, height: "100%", background: col, borderRadius: 3 }} />
                                )}
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: val != null ? col : "var(--mut)", minWidth: 22, textAlign: "right" }}>
                                {val != null ? val : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cmp-body">
          {displayedPillars.map(p => {
            const pillarsSubdomains = meta.subdomains.filter(sd => sd.pillar === p.key);
            const hasAnyData = pillarsSubdomains.some(sd =>
              filtered.some(c => sdScores[c.iso3]?.[sd.key] != null)
            );

            return (
              <div key={p.key} style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #f0f2f5", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 3, height: 16, background: p.color, borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--txt)" }}>{p.label}</span>
                  <span style={{ fontSize: 11, color: "var(--mut)", marginLeft: "auto" }}>
                    {pillarsSubdomains.length} sub-domains · {filtered.length} countries
                  </span>
                </div>
                <div style={{ padding: "12px 16px 28px" }}>
                  {!hasAnyData ? (
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
                        {pillarsSubdomains.map(sd => {
                          const vals = filtered
                            .map(c => ({ c, v: sdScores[c.iso3]?.[sd.key] ?? null }))
                            .filter((x): x is { c: CountryPayload; v: number } => x.v != null);
                          const avg = vals.length
                            ? Math.round(vals.reduce((s, x) => s + x.v, 0) / vals.length)
                            : null;
                          const byScore = new Map<number, string[]>();
                          for (const { c, v } of vals) {
                            (byScore.get(v) ?? byScore.set(v, []).get(v)!).push(c.name);
                          }
                          return (
                            <div key={sd.key} className="strip-row">
                              <div className="strip-label">{sd.label}</div>
                              <div className="strip-track">
                                <div className="strip-axis" />
                                {avg != null && (
                                  <div className="strip-avg-line" style={{ left: `${avg}%` }}>
                                    <div className="strip-avg-label">{avg}</div>
                                  </div>
                                )}
                                {vals.length === 0 ? (
                                  <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--mut)", fontStyle: "italic" }}>
                                    No data
                                  </span>
                                ) : (() => {
                                  const maxCount = Math.max(...Array.from(byScore.values()).map(n => n.length));
                                  return Array.from(byScore.entries()).map(([score, names]) => {
                                    const opacity = maxCount === 1 ? 1 : 0.2 + 0.8 * (names.length / maxCount);
                                    return (
                                      <div
                                        key={score}
                                        className="strip-dot"
                                        style={{ left: `${score}%`, background: p.color, opacity }}
                                        onMouseEnter={e => {
                                          const r = e.currentTarget.getBoundingClientRect();
                                          setTooltip({ x: r.left + r.width / 2, y: r.top, value: score, countries: names });
                                        }}
                                        onMouseLeave={() => setTooltip(null)}
                                      />
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x, top: tooltip.y - 8,
          transform: "translate(-50%, -100%)",
          background: "#1e2a35", color: "#fff",
          padding: "8px 12px", borderRadius: 7, fontSize: 12,
          pointerEvents: "none", zIndex: 9999,
          boxShadow: "0 2px 12px rgba(0,0,0,.3)",
          minWidth: 120, maxWidth: 220, lineHeight: 1.5,
        }}>
          <strong>{tooltip.countries.length} {tooltip.countries.length === 1 ? "country" : "countries"} · score: {tooltip.value}</strong>
          <div style={{ marginTop: 5, fontSize: 11 }}>
            {tooltip.countries.map(name => <div key={name}>{name}</div>)}
          </div>
        </div>
      )}
    </section>
  );
}
