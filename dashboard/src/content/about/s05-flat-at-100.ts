import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "flat-at-100",
  number: 5,
  title: "Why some lines sit flat at 100",
  keywords: ["flat", "clamp", "benchmark", "100", "tie", "soft floor", "brazil", "climate", "russia", "trend"],
  answer: [
    "If a country is already better than the [[benchmark]] for an indicator, it scores 100. Every such country ties, so its line runs flat even when the underlying value keeps improving.",
    "A softer rule is built and switched off. The client chooses which rule the dashboard uses.",
  ],
  detail: [
    {
      id: "the-rule",
      heading: "The rule today",
      body: [
        "Scores measure the gap to a benchmark. Once the gap is zero there is nothing left to measure, so the score is cut off at 100. This is the client's original framework applied faithfully. It is not a data error.",
        "Brazil's climate vulnerability improved steadily from 1995 to 2024, but every year is better than the 0.46 benchmark, so the line is a flat 100.",
      ],
    },
    {
      id: "the-proposal",
      heading: "The proposed soft floor",
      body: [
        "The soft floor keeps the benchmark as a score of 75 and lets better countries spread between 75 and 100, down to the best value anywhere in the data. Ranking and trends above the benchmark become visible, and nothing below the benchmark changes.",
        "Toggle the chart above to compare. The soft floor values are computed from the same source data.",
      ],
    },
    {
      id: "how-common",
      heading: "How common it is",
      body: [
        "In the 2026-10-14 review, 58.5% of climate vulnerability country-years and 72.3% of electricity access country-years were at the cap. The rule applies to every indicator scored against a benchmark, which is most of them.",
      ],
    },
    {
      id: "options",
      heading: "The options on the table",
      body: [
        "A. Keep the rule and explain it, as this page does. B. Use the soft floor, which keeps the benchmark framing and restores variation. C. Drop benchmarks and rank every country against the others each year, which gives the most variation but gives up the client's benchmarks.",
        "This page stays accurate whichever is chosen: it is updated in the same change that applies the decision.",
      ],
    },
  ],
  dashboardLink: { label: "See Brazil on the map", to: "/map?country=BRA" },
  provenance: { updated: "2026-10-15", decisionIds: ["benchmark-rule"] },
};
