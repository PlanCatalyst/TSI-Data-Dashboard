import { useMemo, useState } from "react";

import { seriesColor } from "../../../../components/scores/series-color";
import { BASKET_MIN_PRESENCE, BASKET_WINDOW_YEARS, computePillarTimeseries, getCountryByIso3 } from "../../../../data/contract/selectors";
import { useDashboardData } from "../../../../state/dashboard-context";
import { LineChart, type Series } from "../charts";
import { Segmented } from "../../../../components/controls/Segmented";
import { ShowAsTable } from "../ShowAsTable";
import { basketMembers, fmt1, indicatorLabel, plainMeanSeries, scoredYears, seriesOf, shortLabel } from "./data";

type Rule = "basket" | "old";

const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);

/**
 * Pick a country and a pillar. Each row is an indicator and each column a
 * year; a filled cell means a value exists. Indicators outside the basket are
 * pale. The bottom row marks the years the basket rule scores. The chart
 * compares the overall line under the basket rule with the retired rule that
 * averaged whatever reported each year.
 */
export function BasketGrid() {
  const { meta, countries, timeseries } = useDashboardData();
  const [iso3, setIso3] = useState("BRA");
  const [pillarKey, setPillarKey] = useState("ctx");
  const [rule, setRule] = useState<Rule>("old");

  const sorted = useMemo(() => countries.slice().sort((a, b) => a.name.localeCompare(b.name)), [countries]);
  const country = getCountryByIso3(countries, iso3) ?? sorted[0];

  const calc = useMemo(() => {
    if (!meta || !country) return null;
    const n = meta.years.length;
    const inds = meta.indicators.filter((i) => i.pillar === pillarKey);
    const members = inds.map((i) => seriesOf(timeseries, country.iso3, i.key, n));
    const inBasket = basketMembers(members, n);
    const scored = scoredYears(members, n);

    const basketPillars = computePillarTimeseries(country, timeseries, meta);
    const plainPillars = meta.pillars.map((p) =>
      plainMeanSeries(
        meta.indicators.filter((i) => i.pillar === p.key).map((i) => seriesOf(timeseries, country.iso3, i.key, n)),
        n,
      ),
    );
    const overallNew = Array.from({ length: n }, (_, i) => {
      // Overall needs the six core pillars; socio-economic performance (pri) joins the mean when present.
      const core = meta.pillars.filter((p) => p.key !== "pri").map((p) => basketPillars[p.key][i]);
      if (!core.every((v) => v != null)) return null;
      const extra = basketPillars.pri?.[i];
      const vals = extra != null ? [...(core as number[]), extra] : (core as number[]);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    const overallOld = Array.from({ length: n }, (_, i) => {
      const vals = plainPillars.map((s) => s[i]).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return { n, inds, members, inBasket, scored, overallNew, overallOld };
  }, [meta, country, timeseries, pillarKey]);

  if (!meta || !country || !calc) return null;

  const years = meta.years;
  const series: Series[] =
    rule === "basket"
      ? [{ id: "new", label: "Basket rule", color: "var(--pc-blue)", values: calc.overallNew.map(round1), dots: true }]
      : [
          { id: "old", label: "Retired rule: whatever reported", color: "var(--need-severe)", values: calc.overallOld.map(round1), dots: true },
          { id: "new", label: "Basket rule", color: "var(--pc-blue)", values: calc.overallNew.map(round1), dots: true },
        ];
  const pillarLabel = meta.pillars.find((p) => p.key === pillarKey)?.label ?? pillarKey;

  return (
    <div className="wiki-viz">
      <div className="wiki-curve-controls">
        <label className="wiki-field">
          <span className="small">Country</span>
          <select value={country.iso3} onChange={(e) => setIso3(e.target.value)}>
            {sorted.map((c) => (
              <option key={c.iso3} value={c.iso3}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wiki-field">
          <span className="small">Pillar</span>
          <select value={pillarKey} onChange={(e) => setPillarKey(e.target.value)}>
            {meta.pillars.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="wiki-grid" role="img" aria-label={`Which years each ${pillarLabel} indicator has a value for ${country.name}`}>
        <div className="wiki-grid-axis" aria-hidden="true">
          <span>{years[0]}</span>
          <span>{years[Math.floor(years.length / 2)]}</span>
          <span>{years[years.length - 1]}</span>
        </div>
        {calc.inds.map((ind, k) => (
          <div key={ind.key} className="wiki-grid-row">
            <div className="wiki-grid-label small">
              {shortLabel(indicatorLabel(meta, ind.key), 48)}
              {calc.inBasket[k] ? null : <em> (outside the basket)</em>}
            </div>
            <div className="wiki-grid-cells" style={{ gridTemplateColumns: `repeat(${calc.n}, 1fr)` }}>
              {calc.members[k].map((v, i) => (
                <span
                  key={i}
                  className={`wiki-cell${v != null ? " is-on" : ""}${calc.inBasket[k] ? "" : " is-out"}`}
                  style={v != null ? { background: seriesColor(pillarKey) } : undefined}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="wiki-grid-row wiki-grid-row--scored">
          <div className="wiki-grid-label small">
            <b>Scored years</b>
          </div>
          <div className="wiki-grid-cells" style={{ gridTemplateColumns: `repeat(${calc.n}, 1fr)` }}>
            {calc.scored.map((s, i) => (
              <span key={i} className={`wiki-cell${s ? " is-scored" : ""}`} />
            ))}
          </div>
        </div>
      </div>
      <p className="small">
        The basket is every indicator with a value in the last {BASKET_WINDOW_YEARS} years. A year is scored when at
        least {Math.round(BASKET_MIN_PRESENCE * 100)}% of the basket has a value. Colour means a value exists; pale
        means the indicator is outside the basket; a solid green cell means the year is scored.
      </p>

      <div className="wiki-viz-bar">
        <Segmented
          label="Overall line rule"
          value={rule}
          onChange={setRule}
          options={[
            { value: "basket", label: "Basket rule" },
            { value: "old", label: "Show retired rule" },
          ]}
        />
      </div>
      <LineChart
        years={years}
        series={series}
        ariaLabel={`Overall score for ${country.name} by year under the basket rule${rule === "old" ? " and the retired rule" : ""}`}
        format={(v) => fmt1(v)}
      />
      <p className="small">
        Overall score for {country.name}. Under the basket rule the overall score appears only when the six core pillars
        have a score. The retired rule averaged whichever pillars reported, so a change in which data was published
        looked like a change in the country.
      </p>
      <ShowAsTable
        caption={`${country.name}: ${pillarLabel} basket and overall score by year`}
        columns={["Year", "Indicators with a value", "Scored", "Overall (basket rule)", "Overall (retired rule)"]}
        rows={years.map((y, i) => [
          y,
          calc.members.filter((m) => m[i] != null).length,
          calc.scored[i] ? "yes" : "no",
          round1(calc.overallNew[i]),
          round1(calc.overallOld[i]),
        ])}
      />
    </div>
  );
}
