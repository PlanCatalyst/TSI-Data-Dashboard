import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "decisions",
  number: 12,
  title: "Choices we made, and why",
  keywords: ["decisions", "choices", "locked", "pending", "open", "status", "history", "log"],
  answer: [
    "Here is every important choice we made about how the data is selected and scored, with the date, what we decided, why, and where it stands.",
    "Locked means we decided and it is live. Decision pending means the dashboard behaves one way today and we may choose another. Open issue means we know about it and have not decided.",
  ],
  detail: [
    {
      id: "how-to-read",
      heading: "How to read the log",
      body: [
        "Each row opens to show what we had to settle, what the dashboard does, and why. The date is when we decided or, for pending and open items, when we raised it.",
        "Where an item is pending, the section it links to is written so it stays true either way. We update it in the same change that applies the decision.",
      ],
    },
  ],
  dashboardLink: undefined,
  provenance: { updated: "2026-10-15", decisionIds: [] },
};
