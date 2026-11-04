import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "flat-at-100",
  number: 5,
  title: "When a country is already past the benchmark",
  keywords: ["flat", "clamp", "benchmark", "100", "tie", "soft floor", "brazil", "climate", "russia", "trend"],
  answer: [
    "If a country is already better than the [[benchmark]] for an indicator, it no longer scores a flat 100 the way every such country once did. It scores on a soft floor: 75 at the benchmark, rising toward 100 for the best country on record.",
    "This replaced a rule where every country past the benchmark tied at 100, which hid real improvement above the benchmark.",
  ],
  detail: [
    {
      id: "the-rule",
      heading: "The rule before this change",
      body: [
        "Scores measured the gap to a benchmark. Once the gap was zero there was nothing left to measure, so the score stopped at 100. That was how the scoring framework was designed; it was not a data error, but it meant two countries with very different values both read as 100.",
        "Brazil's climate vulnerability improved steadily from 1995 to 2024, but every year was better than the 0.46 benchmark, so the line used to sit at a flat 100.",
      ],
    },
    {
      id: "the-soft-floor",
      heading: "The soft floor now in effect",
      body: [
        "The soft floor keeps the benchmark as a score of 75 and spreads better countries between 75 and 100, down to the best value anywhere in the data. Ranking and trends above the benchmark are now visible, and nothing below the benchmark changes.",
        "Switch the chart above to compare the retired rule against the soft floor now live. Both lines use the same source data.",
      ],
    },
    {
      id: "how-common",
      heading: "How common it was",
      body: [
        "Before this change, 58.5% of climate vulnerability country-years and 72.3% of electricity access country-years sat at the cap. The soft floor applies to every indicator scored against a benchmark, which is most of them.",
      ],
    },
  ],
  dashboardLink: { label: "See Brazil on the map", to: "/map?country=BRA" },
  provenance: { updated: "2026-11-03", decisionIds: ["benchmark-rule"] },
};
