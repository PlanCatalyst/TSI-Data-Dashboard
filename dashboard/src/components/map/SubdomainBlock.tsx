import { useState } from "react";

import type { Indicator, Pillar, Subdomain, TimeseriesPayload } from "../../data/contract/types";
import { IndicatorTrendMini } from "./IndicatorTrendMini";

type Props = {
  subdomain: Subdomain;
  pillar: Pillar;
  score: number | null;
  indicators: Indicator[];
  timeseries: TimeseriesPayload;
  iso3: string;
  years: number[];
  defaultOpen?: boolean;
};

// Collapsible row for one sub-domain. Closed view shows a small score bar; open
// view reveals indicator-level mini charts. Keeps the panel scrollable on
// mobile without a hard scroll lock.
export function SubdomainBlock({
  subdomain,
  pillar,
  score,
  indicators,
  timeseries,
  iso3,
  years,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const sdIndicators = indicators.filter((ind) => ind.subdomain === subdomain.key);
  const hasIndicators = sdIndicators.length > 0;

  return (
    <div className="sd-block">
      <button
        type="button"
        className="sd-head"
        onClick={() => hasIndicators && setOpen((o) => !o)}
        aria-expanded={open}
        aria-disabled={!hasIndicators}
        style={{
          width: "100%",
          background: "#fff",
          border: "none",
          textAlign: "left",
          cursor: hasIndicators ? "pointer" : "default",
        }}
      >
        <div className="sd-head-left">
          <div className="sd-dot" style={{ background: pillar.color }} />
          <span className="sd-label">{subdomain.label}</span>
        </div>
        <div className="sd-head-right">
          <div className="sd-mini">
            {score != null && (
              <div className="sd-mini-fill" style={{ width: `${score}%`, background: pillar.color }} />
            )}
          </div>
          <span className="sd-val">{score != null ? score : "—"}</span>
          {hasIndicators && (
            <span className={`sd-chev${open ? " open" : ""}`}>▾</span>
          )}
        </div>
      </button>

      {open && hasIndicators && (
        <div className="sd-body open">
          {sdIndicators.map((ind) => (
            <IndicatorTrendMini
              key={ind.key}
              indicator={ind}
              series={timeseries[iso3]?.[ind.key] ?? years.map(() => null)}
              years={years}
              color={pillar.color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
