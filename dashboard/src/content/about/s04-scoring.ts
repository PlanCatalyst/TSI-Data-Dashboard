import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "scoring",
  number: 4,
  title: "How we score each indicator",
  keywords: ["formula", "benchmark", "ratio", "gap", "goal", "index", "bands", "threshold", "28 indicators", "table", "density", "renewable", "family planning", "floor", "relative"],
  answer: [
    "Each [[indicator]] becomes a score from 0 to 100 using one of six formulas, depending on what the source measures. Four compare the value with a [[benchmark]] we set, one takes an index that is already on 0 to 100, and one sorts population density into bands.",
    "Drag the value on any curve below to see the score move.",
  ],
  detail: [
    {
      id: "family-ratio",
      heading: "Ratio to a threshold",
      body: [
        "For measures where lower is better, such as tuberculosis cases per 100,000 people. A country at the benchmark scores 100. A country at twice the benchmark scores 50, and at four times it scores 25. In short, the score is the benchmark divided by the value, capped at 100.",
        "Fourteen indicators use it, including child mortality, stunting, anemia, food insecurity, poverty and the Gender Inequality, climate vulnerability and Multidimensional Poverty indexes.",
      ],
    },
    {
      id: "family-gap",
      heading: "Gap to a coverage benchmark",
      body: [
        "For coverage measures where higher is better, such as the share of people with electricity. We look at the gap, which is 100 minus coverage. The closer a country's gap is to the benchmark gap, the higher its score. In short, the score is the benchmark gap divided by the country's gap, capped at 100.",
        "Five indicators use it: safe water, sanitation, electricity, clean fuels and financial accounts.",
      ],
    },
    {
      id: "family-relative",
      heading: "Gain above a floor",
      body: [
        "For two measures where higher is better and the benchmark is a floor: renewable energy share, with a goal of 20%, and family planning demand satisfied, against the global average of 77.2%. A country at or below the benchmark scores 0. Above it, the score is one minus the benchmark divided by the value, scaled so the best country on record scores 100.",
        "For renewable energy the best on record is 98.3%, so a country at 40% scores about 63 and one at 30% scores about 42. For family planning the best is 96.6%, so a country at 85% scores about 46.",
        "The best value is taken across every year, not year by year, so a country's line moves only when its own value does. Family planning data comes from surveys and some years have only a handful of countries, so a yearly best would hand 100 to whoever happened to report.",
      ],
    },
    {
      id: "family-goal",
      heading: "Share of a goal",
      body: [
        "We use this once, for aid to agriculture. We first turn aid into a share of the country's national income, then compare it with a goal of 2%. At 2% or more the score is 100, at 1% it is 50, and with no aid it is 0.",
      ],
    },
    {
      id: "family-index",
      heading: "Index already on 0 to 100",
      body: [
        "Five sources already publish a score from 0 to 100 where higher is better: essential health service coverage, health emergency preparedness, sustainable agriculture, government effectiveness and the macro-economic performance index. For these we use the value as it is, with no benchmark.",
      ],
    },
    {
      id: "family-bands",
      heading: "Density bands",
      body: [
        "We sort population density into five bands: 250 or more people per square km scores 0, 100 to 249 scores 25, 75 to 99 scores 50, 25 to 74 scores 75, and below 25 scores 100. Denser means more need, and we have confirmed this direction.",
        "An earlier smooth formula pushed almost every country to the same value, so we replaced it.",
      ],
    },
    {
      id: "drift",
      heading: "Where our notes and our scoring disagree",
      body: [
        "A recent check compared our written indicator notes with the scoring itself. This table follows the scoring, because that is what produces the numbers. One reading is still to be settled.",
        "Renewable energy and family planning were settled on 16 October 2026: a 20% renewable share goal and the 77.2% global average for family planning, both scored as a gain above a floor.",
        "Aid to agriculture: aid is in constant 2022 dollars and national income is in current dollars, so the ratio mixes the two.",
      ],
    },
  ],
  dashboardLink: { label: "Open Explore", to: "/explore" },
  provenance: {
    updated: "2026-10-19",
    decisionIds: ["population-density", "renewables-benchmark", "contraception-benchmark", "aid-income-basis"],
  },
};
