import { useMemo } from "react";
import { Link } from "react-router-dom";

import { decisionById } from "../../../../content/about";
import { KIND_LABEL, ODDITIES, type Oddity } from "../../../../content/about/oddities";
import { computePillarTimeseries, getCountryByIso3 } from "../../../../data/contract/selectors";
import type { MetaPayload, TimeseriesPayload, CountriesPayload } from "../../../../data/contract/types";
import { useDashboardData } from "../../../../state/dashboard-context";
import { Sparkline } from "../charts";
import { ShowAsTable } from "../ShowAsTable";
import { StatusChip } from "../StatusChip";
import { Rich } from "../rich";
import { seriesOf } from "./data";

type Spark = {
  values: Array<number | null>;
  max: number;
  kind: "line" | "bars";
  threshold?: { value: number; label: string };
  label: string;
  /** Rendered number format for the table. */
  decimals: number;
};

function build(o: Oddity, meta: MetaPayload, countries: CountriesPayload, ts: TimeseriesPayload): Spark | null {
  const n = meta.years.length;
  const v = o.viz;
  switch (v.type) {
    case "series": {
      const values = seriesOf(ts, v.iso3, v.indicator, n);
      return { values, max: 100, kind: "line", label: o.caption, decimals: 1 };
    }
    case "pillar": {
      const c = getCountryByIso3(countries, v.iso3);
      if (!c) return null;
      return { values: computePillarTimeseries(c, ts, meta)[v.pillar] ?? [], max: 100, kind: "line", label: o.caption, decimals: 0 };
    }
    case "indicator-count": {
      const keys = meta.indicators.filter((i) => i.pillar === v.pillar).map((i) => i.key);
      const values = Array.from({ length: n }, (_, i) => keys.filter((k) => seriesOf(ts, v.iso3, k, n)[i] != null).length);
      return { values, max: keys.length, kind: "bars", label: o.caption, decimals: 0 };
    }
    case "pillar-count": {
      const c = getCountryByIso3(countries, v.iso3);
      if (!c) return null;
      const p = computePillarTimeseries(c, ts, meta);
      const core = meta.pillars.filter((pl) => pl.key !== "pri");
      const values = Array.from({ length: n }, (_, i) => core.filter((pl) => p[pl.key][i] != null).length);
      return { values, max: core.length, kind: "bars", label: o.caption, decimals: 0 };
    }
    case "region-share": {
      const inRegion = countries.filter((c) => c.region === v.region);
      if (!inRegion.length) return null;
      const values = Array.from({ length: n }, (_, i) =>
        Math.round((inRegion.filter((c) => seriesOf(ts, c.iso3, v.indicator, n)[i] != null).length / inRegion.length) * 100),
      );
      return { values, max: 100, kind: "line", threshold: { value: 50, label: "half" }, label: o.caption, decimals: 0 };
    }
    case "country-count": {
      const values = Array.from({ length: n }, (_, i) => countries.filter((c) => seriesOf(ts, c.iso3, v.indicator, n)[i] != null).length);
      return { values, max: Math.max(1, ...values), kind: "bars", label: o.caption, decimals: 0 };
    }
  }
}

/** Where the card links: the example country on the map, or a country that has the data. */
function linkFor(o: Oddity, countries: CountriesPayload, ts: TimeseriesPayload): { to: string; label: string } {
  if (o.viz.type !== "country-count") return o.link;
  const key = o.viz.indicator;
  const c = countries.find((x) => (ts[x.iso3]?.[key] ?? []).some((val) => val != null));
  return c ? { to: `/map?country=${c.iso3}`, label: `Open ${c.name} on the map, then Agriculture` } : o.link;
}

/**
 * Ten things that look like bugs and are not. Each card is a real series from
 * the loaded data, with its cause and a link to a matching country on the map.
 */
export function OddityGallery() {
  const { meta, countries, timeseries } = useDashboardData();
  const cards = useMemo(
    () => (meta ? ODDITIES.map((o) => ({ o, spark: build(o, meta, countries, timeseries), link: linkFor(o, countries, timeseries) })) : []),
    [meta, countries, timeseries],
  );
  if (!meta) return null;

  return (
    <div className="wiki-gallery">
      {cards.map(({ o, spark, link }) => {
        const decision = decisionById(o.decisionId);
        const yrs = meta.years;
        const nonNull = spark ? spark.values.map((val, i) => [yrs[i], val] as const).filter(([, val]) => val != null) : [];
        return (
          <article key={o.id} className="wiki-oddity" id={`oddity-${o.id}`}>
            <header className="wiki-oddity-head">
              <h4>{o.title}</h4>
              <span className={`chip wiki-kind wiki-kind--${o.kind}`}>{KIND_LABEL[o.kind]}</span>
            </header>
            {spark ? (
              <Sparkline
                values={spark.values}
                max={spark.max}
                kind={spark.kind}
                threshold={spark.threshold}
                color={o.kind === "data" ? "var(--s-socio)" : o.kind === "rule" ? "var(--pc-blue)" : "var(--need-moderate)"}
                ariaLabel={`${spark.label}. ${nonNull.length ? `Values from ${nonNull[0][0]} to ${nonNull[nonNull.length - 1][0]}.` : "No values."}`}
              />
            ) : (
              <p className="small">This example is not in the loaded data.</p>
            )}
            <p className="small wiki-oddity-cap">{o.caption}</p>
            <p>
              <b>What you see.</b> {o.symptom}
            </p>
            <p>
              <b>Why.</b> <Rich text={o.cause} />
            </p>
            <p className="wiki-oddity-foot">
              {decision ? <StatusChip status={decision.status} /> : null}
              <Link to={link.to} className="wiki-xref">
                {link.label}
              </Link>
              <Link to={`/about/${o.section}`} className="wiki-xref">
                Full explanation
              </Link>
            </p>
            {spark ? (
              <ShowAsTable
                caption={spark.label}
                columns={["Year", "Value"]}
                rows={yrs.map((y, i) => [y, spark.values[i] == null ? null : Math.round((spark.values[i] as number) * 10 ** spark.decimals) / 10 ** spark.decimals])}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
