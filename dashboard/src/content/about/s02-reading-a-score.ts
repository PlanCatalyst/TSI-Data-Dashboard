import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "reading-a-score",
  number: 2,
  title: "Reading a score",
  keywords: ["0 to 100", "higher is better", "bands", "need", "dash", "missing", "zero", "latest"],
  answer: [
    "Every score runs from 0 to 100, and higher is better, which means less development [[need]]. Scores fall into four bands: 75 and above is low need, 50 to 74 is moderate, 25 to 49 is high, and below 25 is severe.",
    "A dash means there is no data. It never means zero.",
  ],
  detail: [
    {
      id: "what-a-score-is",
      heading: "What a score is",
      body: [
        "Each indicator is measured in its own unit: cases per 100,000 people, a percentage of the population, an index. To compare them, we convert each one to a score from 0 to 100 against a [[benchmark]]. A country at or better than the benchmark scores 100. The further it falls short, the lower the score. ((scoring|How we score each indicator)) shows the five formulas.",
        "A pillar score averages its indicators. The overall score averages the pillars a country has, and needs all six core ones. See ((pillars|how we build each pillar)).",
      ],
    },
    {
      id: "bands",
      heading: "Where the bands come from",
      body: [
        "We fixed the thresholds at 75, 50 and 25 so a band means the same thing everywhere: the map, the tables, the country panel and the charts all use them.",
      ],
    },
    {
      id: "dash",
      heading: "Why a dash is never zero",
      body: [
        "A [[null|missing value]] stays empty from the source file to the screen. We never turn it into 0, because a zero would say the country scores worst when the truth is that nobody measured it.",
        "There are two kinds of blank. Some indicators do not apply to a country, and some apply but lack an input. ((missing-data|When data is missing)) explains both.",
      ],
    },
    {
      id: "latest",
      heading: "Latest year versus all years",
      body: [
        "\"Latest\" is the most recent year with a value. When that year rests on few indicators, the score can look better or worse than the full picture, so the country panel shows how many indicators back it.",
      ],
    },
  ],
  dashboardLink: { label: "Open the map", to: "/map" },
  provenance: { updated: "2026-10-15", decisionIds: [] },
};
