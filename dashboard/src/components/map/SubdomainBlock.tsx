import type { Indicator, IndicatorStatus, Pillar, Subdomain, TimeseriesPayload } from "../../data/contract/types";
import type { IndicatorProjectionView } from "../../data/contract/projections";
import { IndicatorTrendMini } from "./IndicatorTrendMini";
import { Disclosure } from "../controls/Disclosure";

type Props = {
  subdomain: Subdomain;
  pillar: Pillar;
  score: number | null;
  indicators: Indicator[];
  timeseries: TimeseriesPayload;
  iso3: string;
  years: number[];
  defaultOpen?: boolean;
  /** Optional per-indicator §8 views keyed by indicator.key. */
  projectionViews?: Record<string, IndicatorProjectionView>;
  /** Optional §3.1 status per indicator.key for this country. */
  indicatorStatus?: Record<string, IndicatorStatus>;
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
  projectionViews,
  indicatorStatus,
}: Props) {
  const sdIndicators = indicators.filter((ind) => ind.subdomain === subdomain.key);
  const hasIndicators = sdIndicators.length > 0;

  const left = (
    <span className="sd-head-left">
      <span className="sd-dot" style={{ background: pillar.color }} />
      <span className="sd-label">{subdomain.label}</span>
    </span>
  );
  const right = (
    <span className="sd-head-right">
      <span className="sd-mini">
        {score != null && <span className="sd-mini-fill" style={{ width: `${score}%`, background: pillar.color }} />}
      </span>
      <span className="sd-val">{score != null ? score : "\u2014"}</span>
    </span>
  );

  // No indicators: a plain header, nothing to open.
  if (!hasIndicators) {
    return (
      <div className="sd-block">
        <div className="sd-head sd-head--static">
          {left}
          {right}
        </div>
      </div>
    );
  }

  return (
    <Disclosure as="div" className="sd-block" defaultOpen={defaultOpen} title={left} meta={right}>
      <div className="sd-body open">
        {sdIndicators.map((ind) => (
          <IndicatorTrendMini
            key={ind.key}
            indicator={ind}
            series={timeseries[iso3]?.[ind.key] ?? years.map(() => null)}
            years={years}
            color={pillar.color}
            projectionView={projectionViews?.[ind.key] ?? null}
            status={indicatorStatus?.[ind.key] ?? null}
          />
        ))}
      </div>
    </Disclosure>
  );
}
