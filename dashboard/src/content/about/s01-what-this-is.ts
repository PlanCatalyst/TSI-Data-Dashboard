import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "what-this-is",
  number: 1,
  title: "What this dashboard is",
  keywords: ["purpose", "pillars", "subdomains", "indicators", "framework", "impact", "decision support"],
  answer: [
    "This dashboard shows where development need is greatest, country by country. It is a decision-support tool for finding need. It does not measure the impact of any programme.",
    "It covers {countries} countries and {indicators} indicators, grouped into {pillars} [[pillar|pillars]] and {subdomains} [[subdomain|subdomains]], from {firstYear} to {lastYear}.",
  ],
  detail: [
    {
      id: "purpose",
      heading: "What it is for",
      body: [
        "PlanCatalyst uses it to compare countries on the same footing and to see where need is concentrated. A funder, a programme officer or a member of the public can pick a country, see how it scores on each pillar, and see how that score has moved.",
        "Every number comes from a public source. Nothing is estimated for a country that has no data.",
      ],
    },
    {
      id: "not-impact",
      heading: "What it is not",
      body: [
        "A low score does not mean a programme failed, and a rising score does not mean a programme worked. Country-level numbers move for many reasons that no single organisation controls.",
        "The dashboard says how things stand. Whether a given effort caused a change is a different question that this data cannot answer.",
      ],
    },
    {
      id: "structure",
      heading: "How the framework is organised",
      body: [
        "Seven pillars sit at the top: Healthcare, Agriculture, Social infrastructure, Gender equality, Climate adaptation, Country context and Socio-economic performance. Each pillar splits into subdomains, and each subdomain holds one or more indicators.",
        "Most indicators come from the UN Sustainable Development Goals database. Other public sources fill the gaps where that database is thin: gender inequality, climate vulnerability, governance, deep poverty and macro-economic performance. See ((sources|the sources)).",
      ],
    },
  ],
  dashboardLink: { label: "Open the map", to: "/map" },
  provenance: { updated: "2026-10-15", decisionIds: [] },
};
