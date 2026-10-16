import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "scoring",
  number: 4,
  title: "How we score each indicator",
  keywords: ["formula", "benchmark", "ratio", "gap", "goal", "index", "bands", "threshold", "28 indicators", "table", "density", "renewable"],
  answer: [
    "Each [[indicator]] becomes a score from 0 to 100 using one of five formulas, depending on what the source measures. Three compare the value with a [[benchmark]] we set, one takes an index that is already on 0 to 100, and one sorts population density into bands.",
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
        "Seven indicators use it: family planning, safe water, sanitation, electricity, clean fuels, renewable energy and financial accounts.",
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
        "A recent check compared our written indicator notes with the scoring itself. This table follows the scoring, because that is what produces the numbers. Three readings are still to be settled.",
        "Renewable energy: the notes describe a goal of 20% renewable share. The scoring treats 20 points as the allowed shortfall, which is an 80% benchmark.",
        "Family planning: the scoring reads the benchmark of 11.5 as a shortfall, so 88.5% of demand met is the benchmark.",
        "Aid to agriculture: aid is in constant 2022 dollars and national income is in current dollars, so the ratio mixes the two.",
      ],
    },
  ],
  dashboardLink: { label: "Open Explore", to: "/explore" },
  provenance: {
    updated: "2026-10-15",
    decisionIds: ["population-density", "renewables-benchmark", "contraception-benchmark", "aid-income-basis"],
  },
};
