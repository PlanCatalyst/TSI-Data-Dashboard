import type { GlossaryEntry } from "./types";

/** Terms shown with a hover definition wherever the page writes [[id]]. */
export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "need",
    term: "Need",
    definition:
      "How far a country is from the benchmark for an indicator. A score of 100 means no gap left to close; a score of 0 means the largest gap. Higher scores mean lower need.",
    section: "reading-a-score",
  },
  {
    id: "benchmark",
    term: "Benchmark",
    definition:
      "The value the client chose as good enough for one indicator, for example 40 tuberculosis cases per 100,000 people. Scores measure distance from it.",
    section: "scoring",
  },
  {
    id: "clamp",
    term: "Clamp",
    definition:
      "Cutting a score off at 0 or 100. Every country better than a benchmark is clamped to the same top score.",
    section: "flat-at-100",
  },
  {
    id: "soft-floor",
    term: "Soft floor",
    definition:
      "A proposed alternative to the clamp. The benchmark maps to a score of 75 and better countries spread between 75 and 100, so their ranking and trends stay visible.",
    section: "flat-at-100",
  },
  {
    id: "basket",
    term: "Basket",
    definition:
      "The set of indicators that count toward a pillar: those with a value in the last five years of the series. A year is scored only when 75% of the basket is present.",
    section: "pillars",
  },
  {
    id: "pillar",
    term: "Pillar",
    definition:
      "One of the seven top-level groups of indicators, such as Healthcare or Climate adaptation. A pillar score is the basket average of its indicators.",
    section: "what-this-is",
  },
  {
    id: "subdomain",
    term: "Subdomain",
    definition:
      "A smaller group inside a pillar, such as Nutrition inside Healthcare. There are 17 in total.",
    section: "what-this-is",
  },
  {
    id: "indicator",
    term: "Indicator",
    definition:
      "One measured thing, such as tuberculosis incidence or access to electricity, from one source. The dashboard has 28.",
    section: "scoring",
  },
  {
    id: "indicator-status",
    term: "Indicator status",
    definition:
      "Why an indicator has no score for a country: out of scope (the measure does not apply) or incomplete data (it applies, but an input is missing).",
    section: "missing-data",
  },
  {
    id: "sdg-series",
    term: "SDG series",
    definition:
      "A data series from the UN Sustainable Development Goals database, identified by a code such as SH_TBS_INCD for tuberculosis incidence.",
    section: "sources",
  },
  {
    id: "iso3",
    term: "ISO3",
    definition:
      "The three-letter country code, such as BRA for Brazil. Every file in the dashboard joins countries on this code.",
    section: "source-to-screen",
  },
  {
    id: "snapshot",
    term: "Snapshot",
    definition:
      "One complete published set of data files, identified by a run id. The dashboard always shows one whole snapshot, never a mix.",
    section: "release",
  },
  {
    id: "null",
    term: "Missing value",
    definition:
      "No observation. It is stored as empty, never as zero, and shown as a dash.",
    section: "reading-a-score",
  },
];

export function glossaryById(id: string): GlossaryEntry | undefined {
  return GLOSSARY.find((g) => g.id === id);
}
