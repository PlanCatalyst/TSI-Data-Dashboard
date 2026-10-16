import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "sources",
  number: 10,
  title: "Where the data comes from and when it updates",
  keywords: ["sources", "un sdg", "world bank", "undp", "nd-gain", "wgi", "refresh", "update", "six months", "licence", "attribution", "coverage", "years"],
  answer: [
    "Our data comes from six public sources, shown at the top of this page. We fetch each one in full, save it untouched, and update everything by hand about every six months.",
    "The bars below show which years each source covers.",
  ],
  detail: [
    {
      id: "refresh",
      heading: "How and when it updates",
      body: [
        "We update twice a year. A person runs the process, reviews the checks, and publishes. Nothing updates automatically, so the dashboard never changes without someone having looked at it.",
        "Most sources publish once a year or less often, and several lag by a year or more, which is why the latest year on the dashboard is thinner than earlier ones.",
      ],
    },
    {
      id: "attribution",
      heading: "Credit and reuse",
      body: [
        "All the underlying data is publicly available. Reuse of the data follows each provider's own terms, linked from its card at the top of the page. Credit lines are still being confirmed with each provider.",
      ],
    },
    {
      id: "what-we-keep",
      heading: "What we keep from each fetch",
      body: [
        "We save every file exactly as we received it, with a fingerprint, alongside the update that fetched it. That is what lets an independent check rebuild every score from scratch.",
      ],
    },
    {
      id: "what-not-included",
      heading: "What is not covered",
      body: [
        "Some indicators do not apply to every country. The macro-economic performance index, for example, needs debt data that only World Bank borrowers report, so other countries have no score on it. See ((missing-data|when data is missing)).",
      ],
    },
  ],
  dashboardLink: { label: "Open Explore", to: "/explore" },
  provenance: { updated: "2026-10-15", decisionIds: ["refresh-cycle"] },
};
