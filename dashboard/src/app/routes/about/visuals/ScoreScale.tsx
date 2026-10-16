import { useMemo, useState } from "react";

import { needBand, type NeedKey } from "../../../../data/contract/score-context";
import { displayOverall } from "../../../../data/contract/selectors";
import { useDashboardData } from "../../../../state/dashboard-context";
import { ShowAsTable } from "../ShowAsTable";

type Band = { key: NeedKey; label: string; from: number; to: number; meaning: string };

const BANDS: Band[] = [
  { key: "severe", label: "Severe need", from: 0, to: 24, meaning: "Far from the benchmarks. The first place to look for where need is greatest." },
  { key: "high", label: "High need", from: 25, to: 49, meaning: "Well short of the benchmarks on most measures." },
  { key: "moderate", label: "Moderate need", from: 50, to: 74, meaning: "Close to some benchmarks and short of others." },
  { key: "low", label: "Low need", from: 75, to: 100, meaning: "At or near the benchmarks. Less need, not no need." },
];

/**
 * The 0 to 100 scale with its four need bands. Press or hover a band to see
 * countries whose latest overall score falls in it. Examples are the ones
 * nearest the middle of the band, so the same countries show every time.
 */
export function ScoreScale() {
  const { countries } = useDashboardData();
  const [active, setActive] = useState<NeedKey>("low");

  const examples = useMemo(() => {
    const out: Record<NeedKey, Array<{ name: string; score: number }>> = { low: [], moderate: [], high: [], severe: [] };
    for (const c of countries) {
      const s = displayOverall(c);
      const b = needBand(s);
      if (s != null && b) out[b.key].push({ name: c.name, score: s });
    }
    const mid: Record<NeedKey, number> = { severe: 12, high: 37, moderate: 62, low: 87 };
    (Object.keys(out) as NeedKey[]).forEach((k) => {
      out[k].sort((a, b) => Math.abs(a.score - mid[k]) - Math.abs(b.score - mid[k]) || a.name.localeCompare(b.name));
      out[k] = out[k].slice(0, 3);
    });
    return out;
  }, [countries]);

  const band = BANDS.find((b) => b.key === active) ?? BANDS[0];
  const rows = BANDS.slice().reverse().map((b) => [b.label, `${b.from} to ${b.to}`, b.meaning] as Array<string | number>);

  return (
    <div className="wiki-viz">
      <div className="wiki-scale" role="group" aria-label="Need bands on the 0 to 100 scale">
        {BANDS.map((b) => (
          <button
            key={b.key}
            type="button"
            className={`wiki-scale-band wiki-scale-band--${b.key}`}
            aria-pressed={b.key === active}
            onPointerEnter={() => setActive(b.key)}
            onFocus={() => setActive(b.key)}
            onClick={() => setActive(b.key)}
          >
            <span className="wiki-scale-label">{b.label}</span>
            <span className="num">
              {b.from} to {b.to}
            </span>
          </button>
        ))}
        <div className="wiki-scale-nodata">
          <span className="wiki-scale-label">No data</span>
          <span>A dash</span>
        </div>
      </div>
      <div className="wiki-scale-ticks" aria-hidden="true">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
      <div className="wiki-scale-detail" aria-live="polite">
        <p>
          <b>{band.label}</b>, scores {band.from} to {band.to}. {band.meaning}
        </p>
        {examples[active].length ? (
          <ul className="wiki-examples">
            {examples[active].map((e) => (
              <li key={e.name}>
                <span>{e.name}</span>
                <span className="num">{e.score}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small">No country has an overall score in this band in the current data.</p>
        )}
        <p className="small">Overall score, latest year, higher is better.</p>
      </div>
      <ShowAsTable caption="Need bands" columns={["Band", "Score range", "Meaning"]} rows={rows} />
    </div>
  );
}
