import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "sources",
  number: 10,
  title: "Sources and refresh",
  keywords: ["sources", "un sdg", "world bank", "undp", "nd-gain", "wgi", "refresh", "six months", "licence", "attribution", "coverage", "years"],
  answer: [
    "The data comes from six public sources, shown at the top of this page. Each is fetched in full, saved untouched, and refreshed by hand about every six months.",
    "The bars below show which years each source covers.",
  ],
  detail: [
    {
      id: "refresh",
      heading: "How and when it refreshes",
      body: [
        "The agreed cadence is twice a year. A person runs the pipeline, reviews the checks, and publishes. Nothing refreshes automatically, so the dashboard never changes without someone having looked at it.",
        "Most sources publish annually or less often, and several lag by a year or more, which is why the latest year on the dashboard is thinner than earlier ones.",
      ],
    },
    {
      id: "attribution",
      heading: "Attribution and reuse",
      body: [
        "All underlying data is publicly available. Reuse of the underlying data follows each provider's own terms, linked from its card at the top of the page. Final attribution wording is confirmed with each provider.",
      ],
    },
    {
      id: "what-we-keep",
      heading: "What is kept from each fetch",
      body: [
        "Every file is saved exactly as received, with a fingerprint, alongside the run that fetched it. That is what lets an independent check rebuild every score from scratch.",
      ],
    },
    {
      id: "what-not-included",
      heading: "What is not covered",
      body: [
        "Some indicators do not apply to every country. The macro-economic performance index, for example, needs debt data that only World Bank borrowers report, so other countries have no score on it. See ((missing-data|missing data)).",
      ],
    },
  ],
  dashboardLink: { label: "Open Explore", to: "/explore" },
  provenance: { updated: "2026-10-15", decisionIds: ["refresh-cycle"] },
};
