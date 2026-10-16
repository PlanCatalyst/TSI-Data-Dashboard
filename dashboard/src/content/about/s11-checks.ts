import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "checks",
  number: 11,
  title: "How we check the data",
  keywords: ["validation", "rules", "audit", "independent", "block", "match", "reconcile", "quality", "defects", "checks"],
  answer: [
    "We run eleven checks before every publish, and eight of them can stop it. If one fails, nothing goes live and the previous data stays up. We also rebuild every score from the raw files with separate code and compare it with what we published.",
    "On the latest check, every score we made from a valid input matched exactly.",
  ],
  detail: [
    {
      id: "validation-rules",
      heading: "What the checks look for",
      body: [
        "Checks that can stop a publish: two rows for one country and year with different values; a score outside 0 to 100, or with no source value behind it; a series that jumps up and down across several countries; a pillar or overall score built from too few indicators; a country code that is not a real code; an impossible year; aid scored without national income; and a city-only row scored as national.",
        "Checks that warn but do not stop us: a line flat for ten years or more while the source moves; a large share of an indicator sitting at the cap; a pillar score resting on a single indicator; and a jumpy series in one small country.",
      ],
    },
    {
      id: "audit",
      heading: "The independent check",
      body: [
        "Separate scripts read only the raw files and our written method, and never use the code that makes the scores. They rebuild the expected value for every country, indicator and year, then compare it with what we published. Anything that differs by more than 0.15 counts as a mismatch.",
        "A second pass counts rows at every stage between the raw file and the dashboard, so each dropped row has a counted reason.",
      ],
    },
    {
      id: "what-it-found",
      heading: "What the check found",
      body: [
        "We found no scoring mistakes. Every problem was in what got published: values shown with no valid source behind them, and valid values that never reached the dashboard. We fixed four of them. The fifth, debt risk scored from a partial input, is waiting on a decision.",
        "After the fixes, 97,038 of 97,038 expected values match, and no row is unaccounted for.",
      ],
    },
  ],
  dashboardLink: undefined,
  provenance: { updated: "2026-10-15", decisionIds: ["no-invented-scores", "debt-risk-input"] },
};
