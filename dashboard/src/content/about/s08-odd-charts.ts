import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "odd-charts",
  number: 8,
  title: "If a chart looks odd",
  keywords: ["odd", "oddities", "bug", "sawtooth", "jagged", "flat", "gaps", "late", "early", "regional", "gallery", "small", "aid"],
  answer: [
    "A few things on the dashboard look like mistakes but are not. Each card below shows a real chart, explains what causes it, and says whether it comes from the data, from a rule we chose, or from an issue we have not settled.",
  ],
  detail: [
    {
      id: "kinds",
      heading: "Three kinds of cause",
      body: [
        "Property of the data: the source really looks like this, and we have not changed it. Changing it would mean changing the measure. Rule we chose: a deliberate decision in how we make scores, explained in the section the card links to. Open issue: we know about it, have not settled it, and have a possible fix in mind.",
      ],
    },
    {
      id: "what-we-do-not-hide",
      heading: "What we do not hide",
      body: [
        "Where the data is thin, noisy or lumpy, we show it as published. Smoothing or dropping a series would make the picture look cleaner than the data is. Where a rule removes years, as with ((pillars|the basket rule)), we say so.",
      ],
    },
    {
      id: "report",
      heading: "If you see something not listed here",
      body: [
        "A chart that looks wrong and is not on this list is worth telling us about. Every problem we have found so far has been traced, logged, and either fixed or listed in ((decisions|our choices)).",
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
