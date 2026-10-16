import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "flat-at-100",
  number: 5,
  title: "When a country is already past the benchmark",
  keywords: ["flat", "clamp", "benchmark", "100", "tie", "soft floor", "brazil", "climate", "russia", "trend"],
  answer: [
    "If a country is already better than the [[benchmark]] for an indicator, it scores 100. Every such country ties, so its line runs flat, even when the underlying value keeps improving.",
    "We have built a softer rule and switched it off. We have not yet decided which rule the dashboard should use.",
  ],
  detail: [
    {
      id: "the-rule",
      heading: "How it works today",
      body: [
        "Scores measure the gap to a benchmark. Once the gap is zero there is nothing left to measure, so the score stops at 100. This is how our scoring framework was designed. It is not a data error.",
        "Brazil's climate vulnerability improved steadily from 1995 to 2024, but every year is better than the 0.46 benchmark, so the line is a flat 100.",
      ],
    },
    {
      id: "the-proposal",
      heading: "A softer rule we are considering",
      body: [
        "The soft floor keeps the benchmark as a score of 75 and lets better countries spread between 75 and 100, down to the best value anywhere in the data. Ranking and trends above the benchmark become visible, and nothing below the benchmark changes.",
        "Switch the chart above to compare. Both lines use the same source data.",
      ],
    },
    {
      id: "how-common",
      heading: "How common it is",
      body: [
        "In October 2026, 58.5% of climate vulnerability country-years and 72.3% of electricity access country-years sat at the cap. The rule applies to every indicator scored against a benchmark, which is most of them.",
      ],
    },
    {
      id: "options",
      heading: "The choices",
      body: [
        "A. Keep the rule and explain it, as we do here. B. Use the soft floor, which keeps the benchmark and restores the differences between countries. C. Drop benchmarks and rank every country against the others each year. That shows the most variation but gives up our benchmarks.",
        "Whichever we choose, we will update this page in the same change.",
      ],
    },
  ],
  dashboardLink: { label: "See Brazil on the map", to: "/map?country=BRA" },
  provenance: { updated: "2026-10-15", decisionIds: ["benchmark-rule"] },
};
