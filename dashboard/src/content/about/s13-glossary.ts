import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "glossary",
  number: 13,
  title: "Glossary",
  keywords: ["terms", "definitions", "need", "benchmark", "clamp", "basket", "pillar", "subdomain", "indicator", "iso3", "sdg"],
  answer: [
    "These are the terms used across this page, in plain language. Words with a dotted underline show their meaning when you hover or focus them.",
  ],
  detail: [
    {
      id: "use",
      heading: "Using the glossary",
      body: [
        "Press a term to jump to the section that explains it in full. The filter at the top of the contents also searches these terms.",
      ],
    },
  ],
  dashboardLink: undefined,
  provenance: { updated: "2026-10-15", decisionIds: [] },
};
