import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "odd-charts",
  number: 8,
  title: "Why a chart might look odd",
  keywords: ["odd", "oddities", "bug", "sawtooth", "jagged", "flat", "gaps", "late", "early", "regional", "gallery", "small", "aid"],
  answer: [
    "Several things on the dashboard look like bugs but are not. Each card below shows a real chart, says what causes it, and says whether it comes from the data, from a rule we chose, or from an issue still open.",
  ],
  detail: [
    {
      id: "kinds",
      heading: "The three kinds of cause",
      body: [
        "Property of the data: the source really looks like this. Nothing was done to it, and changing it would mean changing the measure. Rule we chose: a deliberate decision in how scores are made, explained in the section the card links to. Open issue: known, not yet decided, with a candidate treatment.",
      ],
    },
    {
      id: "what-we-do-not-hide",
      heading: "What we do not hide",
      body: [
        "Where the data is thin, noisy or lumpy, the dashboard shows it as published. Smoothing or dropping a series would make the picture look cleaner than the data is. Where a rule removes years, as with ((pillars|the basket rule)), the page says so.",
      ],
    },
    {
      id: "report",
      heading: "Seeing something not listed here",
      body: [
        "A chart that looks wrong and is not on this list is worth reporting. Every defect found so far has been traced, logged and either fixed or listed in ((decisions|the decisions log)).",
      ],
    },
  ],
  dashboardLink: { label: "Open Explore", to: "/explore" },
  provenance: {
    updated: "2026-10-15",
    decisionIds: [
      "benchmark-rule",
      "small-populations",
      "lumpy-aid",
      "basket-rule",
      "regional-gaps",
      "indicator-count-badge",
      "population-density",
      "overall-core-pillars",
    ],
  },
};
