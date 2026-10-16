import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "what-this-is",
  number: 1,
  title: "What this dashboard shows",
  keywords: ["purpose", "pillars", "subdomains", "indicators", "framework", "impact", "decision support"],
  answer: [
    "This dashboard shows where development need is greatest, country by country. It helps you decide where to look. It does not measure what any program achieved.",
    "It covers {countries} countries and {indicators} indicators, grouped into {pillars} [[pillar|pillars]] and {subdomains} [[subdomain|subdomains]], from {firstYear} to {lastYear}.",
  ],
  detail: [
    {
      id: "purpose",
      heading: "What it is for",
      body: [
        "We use it to compare countries on the same footing and to see where need is concentrated. Pick a country, see how it scores on each pillar, and see how that score has moved.",
        "Every number comes from a public source. We never estimate a number for a country that has no data.",
      ],
    },
    {
      id: "not-impact",
      heading: "What it does not tell you",
      body: [
        "A low score does not mean a program failed, and a rising score does not mean one worked. Country-level numbers move for many reasons that no single organization controls.",
        "This data shows where need is. It cannot show whether a program caused a change.",
      ],
    },
    {
      id: "structure",
      heading: "How the framework is organized",
      body: [
        "Seven pillars sit at the top: Healthcare, Agriculture, Social infrastructure, Gender equality, Climate adaptation, Country context and Socio-economic performance. Each pillar splits into subdomains, and each subdomain holds one or more indicators.",
        "Most indicators come from the UN Sustainable Development Goals database. We use other public sources where that database is thin: gender inequality, climate vulnerability, governance, deep poverty and economic performance. See ((sources|where the data comes from)).",
      ],
    },
  ],
  dashboardLink: { label: "Open the map", to: "/map" },
  provenance: { updated: "2026-10-15", decisionIds: [] },
};
