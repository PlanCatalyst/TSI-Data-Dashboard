import { useMemo, useState } from "react";

import { FAMILIES, METHODOLOGY } from "../../../../content/about/methodology";
import { META_SOURCE_TO_ID, sourceById } from "../../../../content/about/sources";
import { useDashboardData } from "../../../../state/dashboard-context";
import { indicatorLabel } from "./data";

type SortKey = "label" | "pillar" | "source" | "family";
type Row = { key: string; label: string; pillar: string; source: string; unit: string; family: string; bench: string };

/**
 * All 28 indicators: where each comes from, what it is measured in, how it is
 * scored and against what. Labels, pillars and sources come from the
 * published framework; families and benchmarks from the scoring methodology.
 */
export function MethodologyTable() {
  const { meta } = useDashboardData();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "pillar", dir: 1 });

  const rows = useMemo<Row[]>(() => {
    if (!meta) return [];
    return meta.indicators.map((i) => {
      const m = METHODOLOGY.find((x) => x.key === i.key);
      const src = sourceById(META_SOURCE_TO_ID[i.source] ?? "sdg");
      return {
        key: i.key,
        label: indicatorLabel(meta, i.key),
        pillar: meta.pillars.find((p) => p.key === i.pillar)?.label ?? i.pillar,
        source: src?.name ?? i.source,
        unit: m?.unit ?? i.unit,
        family: FAMILIES.find((f) => f.id === m?.family)?.name ?? "",
        bench: m?.benchmarkText ?? "",
      };
    });
  }, [meta]);

  const sorted = useMemo(() => {
    const out = rows.slice();
    out.sort((a, b) => a[sort.key].localeCompare(b[sort.key]) * sort.dir || a.label.localeCompare(b.label));
    return out;
  }, [rows, sort]);

  const head = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="wiki-sortbtn"
        onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }))}
      >
        {label}
        <span aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</span>
      </button>
    </th>
  );

  return (
    <div className="wiki-tablewrap" tabIndex={0} role="region" aria-label="All indicators and how each is scored">
      <table className="wiki-table wiki-table--wide">
        <caption>{rows.length} indicators</caption>
        <thead>
          <tr>
            {head("label", "Indicator")}
            {head("pillar", "Pillar")}
            {head("source", "Source")}
            <th scope="col">Measured in</th>
            {head("family", "Scoring")}
            <th scope="col">Benchmark</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>{r.pillar}</td>
              <td>{r.source}</td>
              <td>{r.unit}</td>
              <td>{r.family}</td>
              <td>{r.bench}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
