import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "checks",
  number: 11,
  title: "How we check the data",
  keywords: ["validation", "rules", "audit", "independent", "block", "match", "reconcile", "quality", "defects"],
  answer: [
    "Eleven rules run before every publish. Eight of them can stop it: if one fails, nothing goes live and the previous data stays. An independent audit also rebuilds every score from the raw files and compares it with what is published.",
    "On the latest run, every score the pipeline made from a valid input matched the audit exactly.",
  ],
  detail: [
    {
      id: "validation-rules",
      heading: "What the rules look for",
      body: [
        "Rules that can stop a publish: two rows for one country and year with different values; a score outside 0 to 100 or with no source value behind it; a series that jumps up and down across several countries; a pillar or overall score built from too few indicators; a country code that is not a real code; an impossible year; aid scored without national income; and a city-only row scored as national.",
        "Rules that warn: a line flat for ten years or more while the source moves; a large share of an indicator pinned at the cap; a pillar score resting on a single indicator; and a jumpy series in one small country.",
      ],
    },
    {
      id: "audit",
      heading: "The independent audit",
      body: [
        "The audit scripts read only the raw files and the written methodology, and never use the pipeline's code. They rebuild the expected value for every country, indicator and year, then compare it with the published file. Anything that differs by more than 0.15 is a mismatch.",
        "A second pass counts rows at every stage between the raw file and the dashboard, so each dropped row has a counted reason.",
      ],
    },
    {
      id: "what-it-found",
      heading: "What the audit found",
      body: [
        "No scoring mistakes. The defects were all in what got published: values shown with no valid source behind them, and valid values that never reached the dashboard. Four were fixed and a fifth, debt risk scored from a partial input, waits on a client decision.",
        "After the fixes, 97,038 of 97,038 expected values match, with no unexplained drops.",
      ],
    },
  ],
  dashboardLink: undefined,
  provenance: { updated: "2026-10-15", decisionIds: ["no-invented-scores", "debt-risk-input"] },
};
