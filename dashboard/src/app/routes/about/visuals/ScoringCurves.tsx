import { useMemo, useState } from "react";

import {
  FAMILIES,
  METHODOLOGY,
  displayedScore,
  needScore,
  type FamilyId,
  type MethodologyRow,
} from "../../../../content/about/methodology";
import { needBand } from "../../../../data/contract/score-context";
import { useDashboardData } from "../../../../state/dashboard-context";
import { Segmented } from "../../../../components/controls/Segmented";
import { indicatorLabel, shortLabel } from "./data";
import { ShowAsTable } from "../ShowAsTable";

const W = 560;
const H = 220;
const M = { l: 40, r: 14, t: 12, b: 28 };

function Curve({ row, value }: { row: MethodologyRow; value: number }) {
  const { min, max } = row.slider;
  const x = (v: number) => M.l + ((v - min) / (max - min)) * (W - M.l - M.r);
  const y = (s: number) => H - M.b - (s / 100) * (H - M.t - M.b);
  const pts = useMemo(() => {
    const n = 160;
    return Array.from({ length: n + 1 }, (_, k) => {
      const v = min + ((max - min) * k) / n;
      return [v, displayedScore(row, v)] as const;
    });
  }, [row, min, max]);
  const score = displayedScore(row, value);
  const band = needBand(score);
  const bench = row.benchmark;

  return (
    <svg className="wiki-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Score against value for ${row.key}`}>
      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className="wiki-chart-grid" />
          <text x={M.l - 6} y={y(t) + 4} textAnchor="end" className="wiki-chart-axis">
            {t}
          </text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = min + (max - min) * f;
        return (
          <text key={f} x={x(v)} y={H - 8} textAnchor="middle" className="wiki-chart-axis">
            {v >= 100 ? Math.round(v) : Math.round(v * 100) / 100}
          </text>
        );
      })}
      {bench != null && bench >= min && bench <= max ? (
        <g>
          <line x1={x(bench)} x2={x(bench)} y1={M.t} y2={H - M.b} className="wiki-chart-ref" />
          <text x={x(bench) + 4} y={M.t + 12} className="wiki-chart-note">
            benchmark
          </text>
        </g>
      ) : null}
      <polyline
        points={pts.map(([v, s]) => `${x(v).toFixed(1)},${y(s).toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--pc-blue)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        style={{ animation: "none", strokeDasharray: "none", strokeDashoffset: 0 }}
      />
      <line x1={x(value)} x2={x(value)} y1={y(score)} y2={H - M.b} className="wiki-chart-cursor" />
      <circle cx={x(value)} cy={y(score)} r={6} fill={band ? band.fill : "var(--n-400)"} stroke="var(--n-0)" strokeWidth={2} />
    </svg>
  );
}

/**
 * One curve per scoring family. Pick an indicator, drag the value, and watch
 * the score and the need band move. The benchmark is marked on the curve.
 */
export function ScoringCurves() {
  const { meta } = useDashboardData();
  const [family, setFamily] = useState<FamilyId>("ratio");
  const members = METHODOLOGY.filter((m) => m.family === family);
  const [pick, setPick] = useState<Record<string, string>>({});
  const row = members.find((m) => m.key === pick[family]) ?? members[0];
  const [values, setValues] = useState<Record<string, number>>({});
  const value = values[row.key] ?? row.slider.start;
  const fam = FAMILIES.find((f) => f.id === family) ?? FAMILIES[0];
  const score = displayedScore(row, value);
  const band = needBand(score);

  const tableRows = useMemo(() => {
    const pts = 8;
    return Array.from({ length: pts + 1 }, (_, k) => {
      const v = row.slider.min + ((row.slider.max - row.slider.min) * k) / pts;
      const vv = Math.round(v * 1000) / 1000;
      return [vv, needScore(row, vv), Math.round(displayedScore(row, vv) * 10) / 10] as Array<string | number>;
    });
  }, [row]);

  if (!meta) return null;

  return (
    <div className="wiki-viz">
      <Segmented
        label="Scoring family"
        value={family}
        onChange={setFamily}
        options={FAMILIES.map((f) => ({ value: f.id, label: f.name }))}
      />
      <p className="wiki-viz-lead">{fam.rule}</p>
      <div className="wiki-curve-controls">
        {members.length > 1 ? (
          <label className="wiki-field">
            <span className="small">Indicator</span>
            <select
              value={row.key}
              onChange={(e) => setPick((p) => ({ ...p, [family]: e.target.value }))}
            >
              {members.map((m) => (
                <option key={m.key} value={m.key}>
                  {shortLabel(indicatorLabel(meta, m.key), 52)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="small">{shortLabel(indicatorLabel(meta, row.key), 72)}</p>
        )}
        <label className="wiki-field wiki-field--grow">
          <span className="small">
            {fam.axis}: <b className="num">{value}</b> <span>({row.unit})</span>
          </span>
          <input
            type="range"
            min={row.slider.min}
            max={row.slider.max}
            step={row.slider.step}
            value={value}
            onChange={(e) => setValues((v) => ({ ...v, [row.key]: Number(e.target.value) }))}
            aria-valuetext={`${value}, score ${Math.round(score)}`}
          />
        </label>
      </div>
      <Curve row={row} value={value} />
      <div className="wiki-readline" aria-live="polite">
        <span>
          Score <b className="num wiki-bignum">{Math.round(score * 10) / 10}</b>
        </span>
        <span>
          Need on our working scale <b className="num">{needScore(row, value)}</b>
        </span>
        {band ? (
          <span className={`chip chip--${band.key}`}>{band.label}</span>
        ) : null}
        <span className="small">Benchmark: {row.benchmarkText}</span>
      </div>
      <ShowAsTable caption={`Score against value for ${row.key}`} columns={[`Value (${row.unit})`, "Need", "Score"]} rows={tableRows} />
    </div>
  );
}
