import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "pillars",
  number: 7,
  title: "Combining indicators into pillars",
  keywords: ["basket", "pillar", "subdomain", "average", "overall", "75%", "five years", "n of m", "early years", "zigzag", "coverage"],
  answer: [
    "A pillar score averages its indicators, but only the ones that reported in the last five years count, and a year is scored only when at least 75% of them are present. That fixed [[basket]] is why some pillars have no early years.",
    "The \"n of m\" badge says how many of a pillar's indicators back a score.",
  ],
  detail: [
    {
      id: "basket",
      heading: "The basket rule",
      body: [
        "The basket is the set of indicators with a value in the last five years of the series. A year gets a pillar score only if at least 75% of the basket has a value that year. Indicators outside the basket are ignored, and a year that falls short is left blank, never filled in.",
        "The same rule builds the overall line and the regional lines, in the pipeline and in the dashboard, with the same numbers.",
      ],
    },
    {
      id: "why-it-exists",
      heading: "What it fixes",
      body: [
        "Averaging whatever reported that year changes which indicators are in the average from one year to the next. Governance data was published only every other year before 2002, so a plain average alternated between two different baskets and drew a zigzag through almost every country. No single value was wrong.",
        "The cost is honest: countries whose early years rested on one or two indicators lose those years. Use the toggle in the chart to see the old rule.",
      ],
    },
    {
      id: "n-of-m",
      heading: "The \"n of m\" badge",
      body: [
        "In the country panel, a pillar row shows how many of its indicators have a value in the year the score comes from. A score resting on one indicator out of three can swing a lot when that one source changes, so the badge lets you judge its weight yourself.",
        "Hiding thin scores entirely would remove whole pillars for many countries. That would be a client decision, and it has not been made.",
      ],
    },
    {
      id: "subdomains",
      heading: "Subdomains and the overall score",
      body: [
        "In the country panel, a subdomain score is the average of the latest value of each of its indicators. The overall score is the average of the pillars a country has.",
        "The overall score is blank unless the six core pillars all have a score. Socio-economic performance is added to the average when a country has it, and left out when it does not apply.",
      ],
    },
  ],
  dashboardLink: { label: "See Brazil on the map", to: "/map?country=BRA" },
  provenance: {
    updated: "2026-10-15",
    decisionIds: ["basket-rule", "indicator-count-badge", "overall-core-pillars"],
  },
};
