import { useState } from "react";

import type { Pillar } from "../../data/contract/types";

type Series = {
  pillar: Pillar;
  data: Array<number | null>;
  /** Optional §8 interval bands aligned to `years` — drawn only when both lo/hi are finite. */
  bands?: Array<{ lo: number; hi: number } | null>;
};

type Props = {
  years: number[];
  series: Series[];
  // Whether to show the projection-band note below the chart.
  projectionsDisabled?: boolean;
  projectionsNote?: string;
  /** When projections are enabled, vertical divider at/after this year. */
  firstProjectedYear?: number | null;
};

// Multi-pillar line chart used inside the country detail panel. Pure SVG so it
// renders on any device without a chart library, and so iframe height tracking
// stays predictable. Interval bands are only plotted from explicit forecast rows.
export function DomainTrendsChart({
  years,
  series,
  projectionsDisabled,
  projectionsNote,
  firstProjectedYear,
}: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; yearIdx: number } | null>(null);

  const W = 360, H = 200;
  const PAD = { t: 12, b: 26, l: 30, r: 12 };
  const trackW = W - PAD.l - PAD.r;
  const trackH = H - PAD.t - PAD.b;
  const n = years.length;

  const xS = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * trackW : trackW / 2);
  const yS = (v: number) => PAD.t + (1 - v / 100) * trackH;

  const yearLabelIdx = n <= 6
    ? Array.from({ length: n }, (_, i) => i)
    : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];

  const divIdx =
    firstProjectedYear != null && !projectionsDisabled
      ? years.findIndex((y) => y >= firstProjectedYear)
      : -1;
  const divX = divIdx >= 0 ? xS(Math.max(0, divIdx)) : null;

  return (
    <div>
      <div style={{ position: "relative", height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.l} y1={yS(v)} x2={W - PAD.r} y2={yS(v)} stroke="#eef0f3" strokeWidth={1} />
              <text x={PAD.l - 5} y={yS(v) + 3.5} textAnchor="end" fontSize={9} fill="#b0b8c2">{v}</text>
            </g>
          ))}
          {yearLabelIdx.map((i) => (
            <text key={i} x={xS(i)} y={H - PAD.b + 12} textAnchor="middle" fontSize={9} fill="#9aa4ae">
              {years[i]}
            </text>
          ))}

          {divX != null && (
            <line
              x1={divX}
              y1={PAD.t}
              x2={divX}
              y2={H - PAD.b}
              stroke="#dde2ea"
              strokeWidth={1}
              strokeDasharray="3,2"
            />
          )}

          {series.map((s) => {
            const bandPts = (() => {
              if (!s.bands) return null;
              const upper: string[] = [];
              const lower: string[] = [];
              s.bands.forEach((b, i) => {
                if (!b) return;
                upper.push(`${xS(i).toFixed(1)},${yS(b.hi).toFixed(1)}`);
                lower.push(`${xS(i).toFixed(1)},${yS(b.lo).toFixed(1)}`);
              });
              if (upper.length < 1) return null;
              if (upper.length === 1) {
                const i = s.bands.findIndex((b) => b != null);
                const x = xS(i);
                const b = s.bands[i]!;
                return `${(x - 4).toFixed(1)},${yS(b.hi).toFixed(1)} ${(x + 4).toFixed(1)},${yS(b.hi).toFixed(1)} ${(x + 4).toFixed(1)},${yS(b.lo).toFixed(1)} ${(x - 4).toFixed(1)},${yS(b.lo).toFixed(1)}`;
              }
              return [...upper, ...lower.reverse()].join(" ");
            })();

            const pts = s.data
              .map((v, i) => (v != null ? `${xS(i).toFixed(1)},${yS(v).toFixed(1)}` : null))
              .filter(Boolean)
              .join(" ");
            return (
              <g key={s.pillar.key}>
                {bandPts && (
                  <polygon points={bandPts} fill={s.pillar.color} opacity={0.12} />
                )}
                {pts && (
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={s.pillar.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                  />
                )}
                {s.data.map((v, i) =>
                  v == null ? null : (
                    <circle
                      key={i}
                      cx={xS(i).toFixed(1)}
                      cy={yS(v).toFixed(1)}
                      r={2.5}
                      fill={s.pillar.color}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setHover({ x: r.left + r.width / 2, y: r.top, yearIdx: i });
                      }}
                    />
                  ),
                )}
              </g>
            );
          })}
        </svg>

        {hover && (
          <div
            style={{
              position: "fixed",
              left: hover.x,
              top: hover.y - 8,
              transform: "translate(-50%, -100%)",
              background: "#1e2a35",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 7,
              fontSize: 12,
              pointerEvents: "none",
              zIndex: 9999,
              boxShadow: "0 2px 12px rgba(0,0,0,.3)",
              minWidth: 130,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>
              {years[hover.yearIdx]}
              {firstProjectedYear != null &&
              !projectionsDisabled &&
              years[hover.yearIdx] >= firstProjectedYear
                ? " (projected)"
                : ""}
            </strong>
            {series.map((s) => {
              const band = s.bands?.[hover.yearIdx] ?? null;
              const val = s.data[hover.yearIdx];
              return (
                <div key={s.pillar.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: s.pillar.color,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span>{s.pillar.label}:</span>
                  <span style={{ fontWeight: 700, marginLeft: "auto" }}>
                    {val != null
                      ? val
                      : band
                        ? `${band.lo}–${band.hi}`
                        : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10, fontSize: 11 }}>
        {series.map((s) => (
          <span key={s.pillar.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 16,
                height: 2.5,
                background: s.pillar.color,
                borderRadius: 2,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "var(--mut)" }}>{s.pillar.label}</span>
          </span>
        ))}
      </div>

      {projectionsDisabled && (
        <div style={{ fontSize: 11, color: "var(--mut)", fontStyle: "italic", marginTop: 6 }}>
          {projectionsNote ?? "Projections currently disabled — historical only."}
        </div>
      )}
    </div>
  );
}
