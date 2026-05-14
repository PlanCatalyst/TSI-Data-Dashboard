import { useMemo, useState } from "react";
import { useDashboardData } from "../../state/dashboard-context";
import type { CountryPayload } from "../../data/contract/types";

const REG_COLORS: Record<string, string> = {
  afe: "#0079c1", afw: "#005d96", eap: "#b2cd5a", eca: "#7a9a1f",
  lcr: "#e07b35", mna: "#435d7f", sar: "#7a5a9a", nam: "#2a7a3a",
};
const REG_DASH: Record<string, string> = {
  afe: "none", afw: "4,2", eap: "none", eca: "5,3",
  lcr: "2,2", mna: "5,3", sar: "4,2", nam: "2,2",
};
const REGION_ORDER = ["afe", "afw", "eap", "eca", "lcr", "mna", "sar", "nam"];

// ── Sparkline SVG ────────────────────────────────────────────────────────────

function SparkSVG({ series, color }: { series: (number | null)[]; color: string }) {
  const SW = 52, SH = 20;
  const nonNull = series.filter(v => v != null) as number[];
  if (!nonNull.length) return <span style={{ display: "inline-block", width: SW }} />;

  const vMin = Math.min(...nonNull) - 1;
  const vMax = Math.max(...nonNull) + 1;
  const range = vMax - vMin || 1;
  const n = series.length;
  const xS = (i: number) => 1 + (n > 1 ? (i / (n - 1)) * (SW - 2) : (SW - 2) / 2);
  const yS = (v: number) => 1 + (1 - (v - vMin) / range) * (SH - 2);

  const points = series
    .map((v, i) => v != null ? `${xS(i).toFixed(1)},${yS(v).toFixed(1)}` : null)
    .filter(Boolean).join(" ");

  const last = series.reduceRight<{ v: number; i: number } | null>(
    (acc, v, i) => acc ?? (v != null ? { v, i } : null), null
  );

  return (
    <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`}
      style={{ display: "block", overflow: "visible", verticalAlign: "middle" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {last && (
        <circle cx={xS(last.i).toFixed(1)} cy={yS(last.v).toFixed(1)} r="2.5" fill={color} />
      )}
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  filtered: CountryPayload[];
  regionLabel: Record<string, string>;
};

export function TrendsPanel({ filtered, regionLabel }: Props) {
  const { meta, timeseries } = useDashboardData();
  const [domainKey, setDomainKey] = useState("overall");

  if (!meta) return null;

  const n = meta.years.length;

  const domains = [
    { key: "overall", label: "Overall" },
    ...meta.pillars.map(p => ({ key: p.key, label: p.label })),
  ];

  function getDomainSeries(iso3: string, dk: string): (number | null)[] {
    if (meta == null) return [];
    if (dk === "overall") {
      const repKeys = meta.pillars.map(p => p.repIndicator);
      return meta.years.map((_, i) => {
        const vals = repKeys
          .map(k => timeseries[iso3]?.[k]?.[i])
          .filter(v => v != null) as number[];
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      });
    }
    const repKey = meta.pillars.find(p => p.key === dk)?.repIndicator ?? dk;
    return timeseries[iso3]?.[repKey] ?? meta.years.map(() => null);
  }

  const countrySeries = useMemo(
    () => filtered.map(c => ({ ...c, series: getDomainSeries(c.iso3, domainKey) })),
    [filtered, domainKey, timeseries]
  );

  // ── Regional averages ──────────────────────────────────────────────────────

  const regionAvgs = useMemo(() =>
    Object.fromEntries(REGION_ORDER.map(r => {
      const rc = countrySeries.filter(c => c.region === r);
      if (!rc.length) return [r, null];
      const avgs = Array.from({ length: n }, (_, i) => {
        const vals = rc.map(c => c.series[i]).filter(v => v != null) as number[];
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      });
      return [r, avgs as (number | null)[]];
    })),
    [countrySeries, n]
  );

  // ── Spread band ────────────────────────────────────────────────────────────

  const { perYearMin, perYearMax } = useMemo(() => ({
    perYearMin: Array.from({ length: n }, (_, i) => {
      const vals = countrySeries.map(c => c.series[i]).filter(v => v != null) as number[];
      return vals.length ? Math.min(...vals) : null;
    }),
    perYearMax: Array.from({ length: n }, (_, i) => {
      const vals = countrySeries.map(c => c.series[i]).filter(v => v != null) as number[];
      return vals.length ? Math.max(...vals) : null;
    }),
  }), [countrySeries, n]);

  // ── SVG chart geometry ─────────────────────────────────────────────────────

  const W = 500, H = 140;
  const PAD = { t: 12, b: 30, l: 32, r: 8 };
  const trackW = W - PAD.l - PAD.r;
  const xS = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * trackW : trackW / 2);
  const yS = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);

  const bandTop = perYearMax
    .map((v, i) => v != null ? `${xS(i).toFixed(1)},${yS(v).toFixed(1)}` : null)
    .filter(Boolean).join(" ");
  const bandBot = [...perYearMin].reverse()
    .map((v, i) => v != null ? `${xS(n - 1 - i).toFixed(1)},${yS(v).toFixed(1)}` : null)
    .filter(Boolean).join(" ");

  const labelIndices = n <= 6
    ? Array.from({ length: n }, (_, i) => i)
    : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];

  return (
    <div className="card">
      <div className="card-title">Trends across regions</div>
      <p style={{ fontSize: 12, color: "var(--mut)", marginBottom: 10 }}>
        Select a domain to see regional averages. Country sparklines show individual trajectories.
      </p>

      {/* Domain selector */}
      <div className="chart-ind-sel">
        {domains.map(d => (
          <button
            key={d.key}
            className={domainKey === d.key ? "chart-ind-btn active" : "chart-ind-btn"}
            onClick={() => setDomainKey(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Regional averages chart */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".4px", margin: "10px 0 4px" }}>
        Regional averages — {meta.years[0]}–{meta.years[n - 1]}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: H, overflow: "hidden" }}>
        {/* Gridlines */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={PAD.l} y1={yS(v)} x2={W - PAD.r} y2={yS(v)} stroke="#eef0f3" strokeWidth="1" />
            <text x={PAD.l - 4} y={yS(v) + 3.5} textAnchor="end" fontSize="9" fill="#b0b8c2">{v}</text>
          </g>
        ))}
        {/* Year labels */}
        {labelIndices.map(i => (
          <text key={i} x={xS(i)} y={H - PAD.b + 11} textAnchor="middle" fontSize="9" fill="#9aa4ae">
            {meta.years[i]}
          </text>
        ))}
        {/* Spread band */}
        {bandTop && bandBot && (
          <polygon points={`${bandTop} ${bandBot}`} fill="rgba(180,195,210,0.18)" stroke="none" />
        )}
        {/* Region lines */}
        {REGION_ORDER.map(r => {
          const avgs = regionAvgs[r];
          if (!avgs) return null;
          const col = REG_COLORS[r];
          const dash = REG_DASH[r];
          const pts = avgs
            .map((v, i) => v != null ? `${xS(i).toFixed(1)},${yS(v).toFixed(1)}` : null)
            .filter(Boolean).join(" ");
          if (!pts) return null;
          const lastIdx = avgs.reduceRight<number>((acc, v, i) => acc === -1 && v != null ? i : acc, -1);
          const lastVal = lastIdx !== -1 ? avgs[lastIdx] : null;
          return (
            <g key={r}>
              <polyline points={pts} fill="none" stroke={col} strokeWidth="2"
                strokeDasharray={dash === "none" ? undefined : dash}
                strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              {lastVal != null && (
                <circle cx={xS(lastIdx).toFixed(1)} cy={yS(lastVal).toFixed(1)} r="3" fill={col} />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: "var(--mut)" }}>
        {REGION_ORDER.filter(r => regionAvgs[r]).map(r => (
          <span key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 16, height: 2, background: REG_COLORS[r], display: "inline-block" }} />
            {regionLabel[r] ?? r}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(180,195,210,0.35)", display: "inline-block" }} />
          Country spread
        </span>
      </div>

      {/* Sparklines grid */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".4px", margin: "14px 0 4px" }}>
        Country sparklines
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {REGION_ORDER.map(r => {
          const regionRows = countrySeries
            .filter(c => c.region === r)
            .sort((a, b) => {
              const aLast = a.series.reduceRight<number | null>((acc, v) => acc ?? v, null) ?? -1;
              const bLast = b.series.reduceRight<number | null>((acc, v) => acc ?? v, null) ?? -1;
              return bLast - aLast;
            });
          if (!regionRows.length) return null;
          const col = REG_COLORS[r];
          const lastVals = regionRows
            .map(c => c.series.reduceRight<number | null>((acc, v) => acc ?? v, null))
            .filter(v => v != null) as number[];
          const regionAvg = lastVals.length
            ? Math.round(lastVals.reduce((a, b) => a + b, 0) / lastVals.length)
            : null;

          return (
            <div key={r} style={{ border: "1px solid #dde2ea", borderTop: `3px solid ${col}`, borderRadius: "0 0 8px 8px", background: "#fff" }}>
              <div style={{ padding: "7px 8px 5px", display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e2a35" }}>{regionLabel[r] ?? r}</span>
                <span style={{ fontSize: 11, color: "#5f6e7c", whiteSpace: "nowrap" }}>
                  {regionRows.length} countries · avg <strong style={{ color: col }}>{regionAvg ?? "—"}</strong>
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", borderTop: "1px solid #dde2ea" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "3px 4px 4px 8px", fontSize: 9, fontWeight: 700, color: "#9aa4ae", textTransform: "uppercase", letterSpacing: ".3px", textAlign: "left" }}>Country</th>
                    <th style={{ padding: "3px 4px", width: 56, fontSize: 9, fontWeight: 700, color: "#9aa4ae", textTransform: "uppercase", letterSpacing: ".3px" }}>
                      {meta.years[0]}–{String(meta.years[n - 1]).slice(-2)}
                    </th>
                    <th style={{ padding: "3px 4px", width: 28, fontSize: 9, fontWeight: 700, color: "#9aa4ae", textTransform: "uppercase", textAlign: "right" }}>Now</th>
                    <th style={{ padding: "3px 8px 3px 4px", width: 30, fontSize: 9, fontWeight: 700, color: "#9aa4ae", textTransform: "uppercase", textAlign: "right" }}>Chg</th>
                  </tr>
                </thead>
                <tbody style={{ borderTop: "1px solid #dde2ea" }}>
                  {regionRows.map(c => {
                    const nonNull = c.series
                      .map((v, i) => v != null ? { v, i } : null)
                      .filter(Boolean) as { v: number; i: number }[];
                    if (!nonNull.length) return null;
                    const first = nonNull[0].v;
                    const last = nonNull[nonNull.length - 1];
                    const delta = Math.round(last.v - first);
                    const deltaColor = delta > 3 ? "#2a7a3a" : delta < -3 ? "#c0392b" : "#9aa4ae";
                    const shortName = c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name;
                    return (
                      <tr key={c.iso3} style={{ cursor: "default" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f7f9fc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <td style={{ padding: "3px 4px 3px 8px", fontSize: 11, color: "#2a3a48", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 0 }}>
                          {shortName}
                        </td>
                        <td style={{ padding: "2px 4px", width: 56 }}>
                          <SparkSVG series={c.series} color={col} />
                        </td>
                        <td style={{ padding: "2px 4px", width: 28, fontSize: 11.5, fontWeight: 700, color: "#1e2a35", textAlign: "right" }}>
                          {Math.round(last.v)}
                        </td>
                        <td style={{ padding: "2px 8px 2px 4px", width: 30, fontSize: 10.5, fontWeight: 600, color: deltaColor, textAlign: "right" }}>
                          {(delta > 0 ? "+" : "") + delta}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
