import { useId, useMemo, useState, type CSSProperties } from "react";

/**
 * Small hand-built SVG charts for the About visuals. Colours are token
 * references, line draw-in uses the shared .draw class (first render only),
 * and every chart has a text label. No chart library (REQ7.13).
 */

export type Series = {
  id: string;
  label: string;
  /** A token reference such as "var(--s-health)". */
  color: string;
  values: Array<number | null>;
  dash?: string;
  width?: number;
  /** Draw a dot on every point. */
  dots?: boolean;
};

type Marker = { value: number; label: string; color?: string };

type LineChartProps = {
  years: number[];
  series: Series[];
  yMin?: number;
  yMax?: number;
  yTicks?: number[];
  height?: number;
  ariaLabel: string;
  /** Horizontal reference lines, such as the 75 mark. */
  hLines?: Marker[];
  /** Shade a span of years. */
  shade?: { from: number; to: number; label?: string };
  format?: (v: number) => string;
};

const W = 640;
const M = { l: 40, r: 14, t: 12, b: 26 };

function segments(values: Array<number | null>): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}

export function LineChart({
  years,
  series,
  yMin = 0,
  yMax = 100,
  yTicks = [0, 25, 50, 75, 100],
  height = 240,
  ariaLabel,
  hLines = [],
  shade,
  format = (v) => String(Math.round(v * 10) / 10),
}: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId();
  const n = years.length;
  const x = (i: number) => M.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - M.l - M.r));
  const yearX = (yr: number) => M.l + ((yr - years[0]) / Math.max(1, years[n - 1] - years[0])) * (W - M.l - M.r);
  const y = (v: number) => height - M.b - ((v - yMin) / (yMax - yMin)) * (height - M.t - M.b);

  const step = years[n - 1] - years[0] > 20 ? 5 : 2;
  const xTicks = years.filter((yr) => yr % step === 0);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * (W - M.l - M.r);
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / (W - M.l - M.r)) * (n - 1)))));
  }

  const readout = useMemo(() => {
    if (hover == null) return null;
    return series
      .map((s) => ({ label: s.label, color: s.color, v: s.values[hover] }))
      .filter((r) => r.v != null);
  }, [hover, series]);

  return (
    <figure className="wiki-chart">
      <div className="wiki-chart-scroll">
        <svg
          className="draw"
          viewBox={`0 0 ${W} ${height}`}
          role="img"
          aria-label={ariaLabel}
          onPointerLeave={() => setHover(null)}
        >
          {shade ? (
            <g>
              <rect
                x={yearX(shade.from)}
                y={M.t}
                width={Math.max(0, yearX(shade.to) - yearX(shade.from))}
                height={height - M.t - M.b}
                className="wiki-chart-shade"
              />
              {shade.label ? (
                <text x={yearX(shade.from) + 6} y={M.t + 12} className="wiki-chart-note">
                  {shade.label}
                </text>
              ) : null}
            </g>
          ) : null}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className="wiki-chart-grid" />
              <text x={M.l - 6} y={y(t) + 4} textAnchor="end" className="wiki-chart-axis">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((yr) => (
            <text key={yr} x={yearX(yr)} y={height - 8} textAnchor="middle" className="wiki-chart-axis">
              {yr}
            </text>
          ))}
          {hLines.map((h) => (
            <g key={h.label}>
              <line
                x1={M.l}
                x2={W - M.r}
                y1={y(h.value)}
                y2={y(h.value)}
                className="wiki-chart-ref"
                style={h.color ? { stroke: h.color } : undefined}
              />
              <text x={W - M.r} y={y(h.value) - 4} textAnchor="end" className="wiki-chart-note">
                {h.label}
              </text>
            </g>
          ))}
          {series.map((s) =>
            segments(s.values).map((seg, k) => {
              const dashed = s.dash != null;
              // The shared draw-in class assumes a 1200 unit line; size it to this one so
              // long, jagged series are not cut off.
              let len = 0;
              for (let q = 1; q < seg.length; q++) {
                len += Math.hypot(
                  x(seg[q]) - x(seg[q - 1]),
                  y(s.values[seg[q]] as number) - y(s.values[seg[q - 1]] as number),
                );
              }
              const drawLen = Math.ceil(len) + 2;
              return seg.length > 1 ? (
                <polyline
                  key={`${s.id}-${k}`}
                  points={seg.map((i) => `${x(i).toFixed(1)},${y(s.values[i] as number).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={
                    dashed
                      ? { animation: "none", strokeDasharray: s.dash, strokeDashoffset: 0 }
                      : ({ "--len": drawLen } as CSSProperties)
                  }
                />
              ) : (
                <circle key={`${s.id}-${k}`} cx={x(seg[0])} cy={y(s.values[seg[0]] as number)} r={3} fill={s.color} />
              );
            }),
          )}
          {series.map((s) =>
            s.dots
              ? s.values.map((v, i) =>
                  v == null ? null : <circle key={`${s.id}-d${i}`} cx={x(i)} cy={y(v)} r={2.6} fill={s.color} />,
                )
              : null,
          )}
          {hover != null ? (
            <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={height - M.b} className="wiki-chart-cursor" />
          ) : null}
          <rect
            x={M.l}
            y={M.t}
            width={W - M.l - M.r}
            height={height - M.t - M.b}
            fill="transparent"
            onPointerMove={onMove}
            data-uid={uid}
          />
        </svg>
      </div>
      <figcaption className="wiki-legend">
        {series.map((s) => (
          <span key={s.id} className="wiki-key">
            <span
              className="wiki-swatch"
              style={{ background: s.dash ? "transparent" : s.color, borderTop: s.dash ? `2px dashed ${s.color}` : undefined }}
            />
            {s.label}
          </span>
        ))}
        <span className="wiki-readout small" aria-hidden="true">
          {hover != null && readout
            ? `${years[hover]}: ${readout.length ? readout.map((r) => `${r.label} ${format(r.v as number)}`).join(", ") : "no data"}`
            : "Hover for values"}
        </span>
      </figcaption>
    </figure>
  );
}

type SparkProps = {
  values: Array<number | null>;
  min?: number;
  max: number;
  /** "bars" suits counts, "line" suits scores. */
  kind?: "line" | "bars";
  threshold?: { value: number; label: string };
  color?: string;
  ariaLabel: string;
  height?: number;
};

export function Sparkline({ values, min = 0, max, kind = "line", threshold, color = "var(--pc-blue)", ariaLabel, height = 64 }: SparkProps) {
  const w = 240;
  const n = values.length;
  const x = (i: number) => 2 + (n <= 1 ? 0 : (i / (n - 1)) * (w - 4));
  const y = (v: number) => height - 4 - ((v - min) / Math.max(1e-9, max - min)) * (height - 8);
  return (
    <svg className="wiki-spark draw" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
      <line x1={0} x2={w} y1={height - 3} y2={height - 3} className="wiki-chart-grid" vectorEffect="non-scaling-stroke" />
      {threshold ? (
        <line x1={0} x2={w} y1={y(threshold.value)} y2={y(threshold.value)} className="wiki-chart-ref" vectorEffect="non-scaling-stroke" />
      ) : null}
      {kind === "bars"
        ? values.map((v, i) =>
            v == null || v <= 0 ? null : (
              <rect key={i} x={x(i) - (w / n) * 0.35} width={(w / n) * 0.7} y={y(v)} height={height - 3 - y(v)} fill={color} />
            ),
          )
        : segments(values).map((seg, k) =>
            seg.length > 1 ? (
              <polyline
                key={k}
                points={seg.map((i) => `${x(i).toFixed(1)},${y(values[i] as number).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <circle key={k} cx={x(seg[0])} cy={y(values[seg[0]] as number)} r={2} fill={color} />
            ),
          )}
    </svg>
  );
}
