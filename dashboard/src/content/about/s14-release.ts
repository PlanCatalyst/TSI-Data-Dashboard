import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "release",
  number: 14,
  title: "What changed in this update",
  keywords: ["release", "update", "snapshot", "version", "changelog", "run id", "generated", "date", "what changed"],
  answer: [
    "This page describes the update below. Every number on the dashboard comes from this one [[snapshot]], never a mix of updates.",
  ],
  detail: [
    {
      id: "changes",
      heading: "What changed since the last update",
      body: [
        "The list in the card above is the short version. Each change is also in ((decisions|our choices)), with the reason.",
      ],
    },
    {
      id: "next",
      heading: "What happens at the next update",
      body: [
        "We rebuild everything from fresh source files and check it again before it goes live. If we settle any pending item, the affected scores change in that update, and we record it in ((decisions|our choices)).",
      ],
    },
  ],
  dashboardLink: { label: "Open the map", to: "/map" },
  provenance: { updated: "2026-10-15", decisionIds: [] },
};
