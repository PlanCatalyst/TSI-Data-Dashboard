import type { Indicator } from "../../data/contract/types";
import { trendBucket, trendDelta } from "../../data/contract/selectors";

type Props = {
  indicator: Indicator;
  series: Array<number | null>;
  years: number[];
  color: string;
};

// Per-indicator mini chart shown inside an open subdomain block.
// Pure SVG; no Chart.js. Keeps things lightweight and projection-aware: dotted
// line for any portion past `firstProjectedYear` (only when projections.enabled).
export function IndicatorTrendMini({ indicator, series, years, color }: Props) {
  const latestIdx = (() => {
    for (let i = series.length - 1; i >= 0; i--) if (series[i] != null) return i;
    return -1;
  })();
  const latest = latestIdx >= 0 ? series[latestIdx] : null;
  const delta = trendDelta(series);
  const bucket = trendBucket(delta);

  const W = 320;
  const H = 100;
  const PAD = { t: 6, b: 24, l: 30, r: 8 };
  const tW = W - PAD.l - PAD.r;
  const tH = H - PAD.t - PAD.b;
  const n = years.length;

  const numericVals = series.filter((v): v is number => v != null);
  const hasData = numericVals.length > 0;

  const yMin = hasData ? Math.max(0, Math.floor((Math.min(...numericVals) - 5) / 5) * 5) : 0;
  const yMaxRaw = hasData ? Math.ceil((Math.max(...numericVals) + 5) / 5) * 5 : 100;
  const yMax = Math.max(yMaxRaw, yMin + 10);

  const xS = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * tW : tW / 2);
  const yS = (v: number) => PAD.t + (1 - (Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin || 1)) * tH;

  const yStep = Math.max(5, Math.ceil((yMax - yMin) / 4 / 5) * 5);
  const yTicks: number[] = [];
  for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) yTicks.push(y);

  const yearTickIdx = n <= 5
    ? Array.from({ length: n }, (_, i) => i)
    : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];

  const linePts = series
    .map((v, i) => (v != null ? `${xS(i).toFixed(1)},${yS(v).toFixed(1)}` : null))
    .filter(Boolean)
    .join(" ");

  const deltaCol = bucket === "up" ? "#2a7a3a" : bucket === "down" ? "#c0392b" : "#817d77";
  const deltaStr =
    delta == null
      ? "—"
      : `${delta > 0 ? "+" : ""}${Math.round(delta)} since ${years[0]}`;

  const chipClass = bucket === "up" ? "chip-up" : bucket === "flat" ? "chip-fl" : bucket === "down" ? "chip-em" : "chip-em";
  const chipText = bucket === "up" ? "▲ Improving" : bucket === "down" ? "↓ Declining" : bucket === "flat" ? "→ Stable" : "—";

  return (
    <div className="ind-row-dp">
      <div className="ind-name">
        {indicator.sdg !== "—" && `${indicator.sdg} · `}
        {indicator.label}
      </div>
      <div className="ind-meta">{indicator.unit}</div>
      <div className="ind-src">{indicator.source}</div>

      <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0, width: 70 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>
            {latest != null ? latest : "—"}
          </div>
          <div style={{ fontSize: 9.5, color: "var(--mut)", marginTop: 3, lineHeight: 1.3 }}>
            {latest != null && latestIdx >= 0 ? `as of ${years[latestIdx]}` : "no data"}
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: deltaCol, marginTop: 5 }}>
            {deltaStr}
          </div>
          <span className={`ind-chip ${chipClass}`} style={{ marginTop: 4, display: "inline-block" }}>
            {chipText}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {!hasData ? (
            <div
              style={{
                fontSize: 11,
                color: "var(--mut)",
                fontStyle: "italic",
                padding: "20px 0",
                textAlign: "center",
              }}
            >
              No data available for this indicator.
            </div>
          ) : (
            <svg
              width="100%"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              style={{ display: "block", overflow: "visible" }}
            >
              {yTicks.map((y) => (
                <g key={y}>
                  <line x1={PAD.l} y1={yS(y).toFixed(1)} x2={W - PAD.r} y2={yS(y).toFixed(1)} stroke="#eef0f3" strokeWidth={1} />
                  <text x={PAD.l - 5} y={Number(yS(y).toFixed(1)) + 3.5} textAnchor="end" fontSize={9} fill="#b0b8c2">{y}</text>
                </g>
              ))}
              {yearTickIdx.map((i) => (
                <text key={i} x={xS(i).toFixed(1)} y={(H - PAD.b + 11).toFixed(1)} textAnchor="middle" fontSize={9} fill="#b0b8c2">
                  {years[i]}
                </text>
              ))}
              {linePts && (
                <polyline
                  points={linePts}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {series.map((v, i) =>
                v == null ? null : (
                  <circle
                    key={i}
                    cx={xS(i).toFixed(1)}
                    cy={yS(v).toFixed(1)}
                    r={3}
                    fill={color}
                    opacity={0.85}
                  >
                    <title>{`${years[i]}: ${v}`}</title>
                  </circle>
                ),
              )}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
