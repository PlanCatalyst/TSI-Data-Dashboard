import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "pillars",
  number: 7,
  title: "How we build each pillar",
  keywords: ["basket", "pillar", "subdomain", "average", "overall", "75%", "five years", "n of m", "early years", "zigzag", "coverage"],
  answer: [
    "A pillar score averages its indicators. Only the indicators that reported in the last five years count, and we score a year only when at least 75% of them have a value. We call this fixed set the [[basket]]. It is why some pillars have no early years.",
    "The \"n of m\" badge tells you how many of a pillar's indicators back a score.",
  ],
  detail: [
    {
      id: "basket",
      heading: "The basket rule",
      body: [
        "The basket is the set of indicators with a value in the last five years of the series. A year gets a pillar score only if at least 75% of the basket has a value that year. We ignore indicators outside the basket, and a year that falls short stays blank. We never fill it in.",
        "We use the same rule for the overall line and the regional lines, in our calculations and on the dashboard, with the same numbers.",
      ],
    },
    {
      id: "why-it-exists",
      heading: "What it fixes",
      body: [
        "If we averaged whatever reported each year, the set of indicators in the average would change from year to year. Governance data was published only every other year before 2002, so a plain average swung between two different sets and drew a zigzag through almost every country. No single value was wrong.",
        "The cost is that some countries lose early years, because too few indicators reported then. Use the toggle in the chart to see the old way.",
      ],
    },
    {
      id: "n-of-m",
      heading: "The \"n of m\" badge",
      body: [
        "In the country panel, a pillar row shows how many of its indicators have a value in the year the score comes from. A score resting on one indicator out of three can swing a lot when that one source changes, so the badge lets you judge how much weight it deserves.",
        "We could hide thin scores entirely, but that would remove whole pillars for many countries. We have not decided to do that.",
      ],
    },
    {
      id: "subdomains",
      heading: "Subdomains and the overall score",
      body: [
        "In the country panel, a subdomain score is the average of the latest value of each of its indicators. The overall score is the average of the pillars a country has.",
        "The overall score is blank unless the six core pillars all have a score. We add socio-economic performance to the average when a country has it, and leave it out when it does not apply.",
      ],
    },
  ],
  dashboardLink: { label: "See Brazil on the map", to: "/map?country=BRA" },
  provenance: {
    updated: "2026-10-15",
    decisionIds: ["basket-rule", "indicator-count-badge", "overall-core-pillars"],
  },
};
