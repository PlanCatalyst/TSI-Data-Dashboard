import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "release",
  number: 14,
  title: "This release",
  keywords: ["release", "snapshot", "version", "changelog", "run id", "generated", "date", "what changed"],
  answer: [
    "This page describes the data release below. The numbers on the dashboard all come from this one [[snapshot]], never a mix of runs.",
  ],
  detail: [
    {
      id: "changes",
      heading: "What changed since the last release",
      body: [
        "The list in the card above is the short version. Each change is also in the ((decisions|decisions log)), with the reason.",
      ],
    },
    {
      id: "next",
      heading: "What happens at the next refresh",
      body: [
        "Everything is rebuilt from fresh source files and checked again before it goes live. If the client decides any pending item, the affected scores change in that release and the ((decisions|log)) records it.",
      ],
    },
  ],
  dashboardLink: { label: "Open the map", to: "/map" },
  provenance: { updated: "2026-10-15", decisionIds: [] },
};
