import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "decisions",
  number: 12,
  title: "Decisions log",
  keywords: ["decisions", "locked", "pending", "open", "status", "history", "client", "log"],
  answer: [
    "Every material choice about how the data is selected and scored is listed here, with the date, what was decided, why, and where it stands.",
    "Locked means decided and shipped. Pending client decision means the dashboard behaves one way today and the client may choose another. Open issue means known and not yet decided.",
  ],
  detail: [
    {
      id: "how-to-read",
      heading: "How to read the log",
      body: [
        "Each row opens to show what had to be settled, what the dashboard does, and why. The date is when it was decided or, for pending and open items, when it was raised.",
        "Where an entry is pending, the section it links to is written so it stays true either way, and is updated in the same change that applies the decision.",
      ],
    },
  ],
  dashboardLink: undefined,
  provenance: { updated: "2026-10-15", decisionIds: [] },
};
