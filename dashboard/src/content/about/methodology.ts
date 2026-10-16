/**
 * Scoring methodology for all 28 indicators (section 4).
 *
 * Hand-kept in this release (requirements REQ9.11 as changed 2026-10-15) and
 * checked against meta.json by `npm run check:about`. Families, benchmarks and
 * formulas are read from the scoring code, not from the indicator catalogue,
 * because the 2026-10-15 audit found the two disagree in places (named in
 * section 4). Labels, pillars and sources come from meta.json at runtime so
 * they cannot drift; only the labels listed in LABEL_OVERRIDES are corrected
 * here.
 */

export type FamilyId = "ratio" | "gap" | "goal" | "index" | "bands";

export type Family = {
  id: FamilyId;
  name: string;
  /** One plain sentence on how the score is made. */
  rule: string;
  /** What the slider moves. */
  axis: string;
};

export const FAMILIES: Family[] = [
  {
    id: "ratio",
    name: "Ratio to a threshold",
    rule: "Lower values are better. The score is the benchmark divided by the value, capped at 100.",
    axis: "Measured value",
  },
  {
    id: "gap",
    name: "Gap to a coverage benchmark",
    rule: "Higher coverage is better. The score is the benchmark gap divided by the country's gap (100 minus coverage), capped at 100.",
    axis: "Coverage, % of population",
  },
  {
    id: "goal",
    name: "Share of a goal",
    rule: "More is better. The score is the value divided by the goal, capped at 100.",
    axis: "Aid, % of national income",
  },
  {
    id: "index",
    name: "Index already on 0 to 100",
    rule: "The source already publishes a 0 to 100 score where higher is better. The score is that value.",
    axis: "Published index value",
  },
  {
    id: "bands",
    name: "Density bands",
    rule: "Five bands. The denser the country, the lower the score.",
    axis: "People per square km",
  },
];

export type MethodologyRow = {
  key: string;
  family: FamilyId;
  /** Plain description of the measure, as scored. */
  unit: string;
  /** The benchmark in the indicator's own unit. Null for bands and indexes. */
  benchmark: number | null;
  /** Benchmark as written in the table. */
  benchmarkText: string;
  /** Slider range for the curve. */
  slider: { min: number; max: number; step: number; start: number };
};

export const METHODOLOGY: MethodologyRow[] = [
  { key: "uhc", family: "index", unit: "Index, 0 to 100", benchmark: null, benchmarkText: "None, value is the score", slider: { min: 0, max: 100, step: 1, start: 70 } },
  { key: "tb", family: "ratio", unit: "Cases per 100,000 people", benchmark: 40, benchmarkText: "40 per 100,000", slider: { min: 1, max: 400, step: 1, start: 120 } },
  { key: "mal", family: "ratio", unit: "Cases per 1,000 people at risk", benchmark: 10, benchmarkText: "10 per 1,000", slider: { min: 1, max: 400, step: 1, start: 60 } },
  { key: "mmr", family: "ratio", unit: "Deaths per 100,000 live births", benchmark: 70, benchmarkText: "70 per 100,000", slider: { min: 1, max: 1200, step: 5, start: 300 } },
  { key: "u5mr", family: "ratio", unit: "Deaths per 1,000 live births", benchmark: 25, benchmarkText: "25 per 1,000", slider: { min: 1, max: 150, step: 1, start: 50 } },
  { key: "stunt", family: "ratio", unit: "% of children under 5", benchmark: 12, benchmarkText: "12%", slider: { min: 1, max: 60, step: 0.5, start: 25 } },
  { key: "maln", family: "ratio", unit: "% of children under 5", benchmark: 2.5, benchmarkText: "2.5%", slider: { min: 0.5, max: 25, step: 0.5, start: 8 } },
  { key: "anaem", family: "ratio", unit: "% of women aged 15 to 49", benchmark: 25, benchmarkText: "25%", slider: { min: 5, max: 75, step: 1, start: 40 } },
  { key: "contra", family: "gap", unit: "% of women aged 15 to 49 with need met", benchmark: 88.5, benchmarkText: "88.5% coverage (gap of 11.5)", slider: { min: 0, max: 100, step: 1, start: 70 } },
  { key: "abr", family: "ratio", unit: "Births per 1,000 girls aged 15 to 19", benchmark: 20, benchmarkText: "20 per 1,000", slider: { min: 1, max: 200, step: 1, start: 60 } },
  { key: "ihr", family: "index", unit: "Capacity score, 0 to 100", benchmark: null, benchmarkText: "None, value is the score", slider: { min: 0, max: 100, step: 1, start: 65 } },
  { key: "food", family: "ratio", unit: "% of population", benchmark: 20, benchmarkText: "20%", slider: { min: 1, max: 100, step: 1, start: 45 } },
  { key: "susag", family: "index", unit: "% of agricultural area", benchmark: null, benchmarkText: "None, value is the score", slider: { min: 0, max: 100, step: 1, start: 40 } },
  { key: "agoda", family: "goal", unit: "Aid as % of national income", benchmark: 2, benchmarkText: "2% of national income", slider: { min: 0, max: 4, step: 0.05, start: 0.5 } },
  { key: "water", family: "gap", unit: "% of population using safely managed drinking water", benchmark: 72.9, benchmarkText: "72.9% coverage (gap of 27.1)", slider: { min: 0, max: 100, step: 1, start: 60 } },
  { key: "sanit", family: "gap", unit: "% of population using safely managed sanitation", benchmark: 57, benchmarkText: "57% coverage (gap of 43)", slider: { min: 0, max: 100, step: 1, start: 45 } },
  { key: "washmort", family: "ratio", unit: "Deaths per 100,000 people", benchmark: 10, benchmarkText: "10 per 100,000", slider: { min: 0.5, max: 100, step: 0.5, start: 25 } },
  { key: "elec", family: "gap", unit: "% of population with access", benchmark: 90.2, benchmarkText: "90.2% coverage (gap of 9.8)", slider: { min: 0, max: 100, step: 1, start: 75 } },
  { key: "clean", family: "gap", unit: "% of population", benchmark: 69.6, benchmarkText: "69.6% coverage (gap of 30.4)", slider: { min: 0, max: 100, step: 1, start: 50 } },
  { key: "renew", family: "gap", unit: "% of final energy consumption", benchmark: 80, benchmarkText: "80% share (gap of 20), see note", slider: { min: 0, max: 100, step: 1, start: 40 } },
  { key: "finc", family: "gap", unit: "% of adults aged 15 and over", benchmark: 55, benchmarkText: "55% coverage (gap of 45)", slider: { min: 0, max: 100, step: 1, start: 40 } },
  { key: "gii", family: "ratio", unit: "Index, 0 (equal) to 1 (unequal)", benchmark: 0.32, benchmarkText: "0.32", slider: { min: 0.05, max: 0.9, step: 0.01, start: 0.5 } },
  { key: "ndgain", family: "ratio", unit: "Vulnerability, 0 to 1", benchmark: 0.46, benchmarkText: "0.46", slider: { min: 0.2, max: 0.8, step: 0.01, start: 0.55 } },
  { key: "state", family: "index", unit: "Governance score, 0 to 100", benchmark: null, benchmarkText: "None, value is the score", slider: { min: 0, max: 100, step: 1, start: 50 } },
  { key: "pov", family: "ratio", unit: "% below the national poverty line", benchmark: 10, benchmarkText: "10%", slider: { min: 1, max: 90, step: 1, start: 30 } },
  { key: "mpi", family: "ratio", unit: "Index, 0 to 1", benchmark: 0.089, benchmarkText: "0.089", slider: { min: 0.01, max: 0.7, step: 0.01, start: 0.25 } },
  { key: "popdens", family: "bands", unit: "People per square km", benchmark: null, benchmarkText: "Bands at 25, 75, 100 and 250", slider: { min: 0, max: 500, step: 5, start: 120 } },
  { key: "mspi", family: "index", unit: "Index, 0 to 100", benchmark: null, benchmarkText: "None, value is the score", slider: { min: 0, max: 100, step: 1, start: 50 } },
];

/**
 * Labels corrected for this page only. The indicator catalogue has the wrong
 * wording for these; fixing it at the source is tracked in TASKS.md. Remove an
 * entry once meta.json carries the right label.
 */
export const LABEL_OVERRIDES: Record<string, string> = {
  sanit: "Proportion of population using safely managed sanitation services",
};

export function methodologyFor(key: string): MethodologyRow | undefined {
  return METHODOLOGY.find((m) => m.key === key);
}

/**
 * Score shown on the dashboard (higher is better) for a raw value, as the
 * scoring code computes it before the publish step flips orientation:
 * need = clamp(...), displayed = 100 - need.
 */
export function displayedScore(row: MethodologyRow, value: number): number {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  switch (row.family) {
    case "ratio": {
      const t = row.benchmark ?? 1;
      return value <= t ? 100 : clamp((100 * t) / value);
    }
    case "gap": {
      const benchGap = 100 - (row.benchmark ?? 100);
      const gap = 100 - value;
      return gap <= benchGap ? 100 : clamp((100 * benchGap) / gap);
    }
    case "goal":
      return clamp((100 * value) / (row.benchmark ?? 1));
    case "index":
      return clamp(value);
    case "bands":
      if (value >= 250) return 0;
      if (value >= 100) return 25;
      if (value >= 75) return 50;
      if (value >= 25) return 75;
      return 100;
  }
}

/** The same value on the pipeline's own scale, where higher means more need. */
export function needScore(row: MethodologyRow, value: number): number {
  return Math.round((100 - displayedScore(row, value)) * 10) / 10;
}
