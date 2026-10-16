import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "scoring",
  number: 4,
  title: "How each indicator is scored",
  keywords: ["formula", "benchmark", "ratio", "gap", "goal", "index", "bands", "threshold", "28 indicators", "table", "density", "renewable"],
  answer: [
    "Each [[indicator]] becomes a 0 to 100 score by one of five formulas, depending on what the source measures. Three compare the value with a [[benchmark]] the client supplied, one takes an index that is already on 0 to 100, and one sorts population density into bands.",
    "Drag the value on any curve below to see the score move.",
  ],
  detail: [
    {
      id: "family-ratio",
      heading: "Ratio to a threshold",
      body: [
        "Used for measures where lower is better, such as tuberculosis cases per 100,000 people. The score is the benchmark divided by the value, capped at 100. A country at the benchmark scores 100, a country at twice the benchmark scores 50, and a country at four times scores 25.",
        "Fourteen indicators use it, including child mortality, stunting, anaemia, food insecurity, poverty and the Gender Inequality, climate vulnerability and Multidimensional Poverty indexes.",
      ],
    },
    {
      id: "family-gap",
      heading: "Gap to a coverage benchmark",
      body: [
        "Used for coverage measures where higher is better, such as the share of people with electricity. The gap is 100 minus coverage. The score is the benchmark gap divided by the country's gap, capped at 100.",
        "Seven indicators use it: family planning, safe water, sanitation, electricity, clean fuels, renewable energy and financial accounts.",
      ],
    },
    {
      id: "family-goal",
      heading: "Share of a goal",
      body: [
        "Used once, for aid to agriculture. Aid is first turned into a share of the country's national income, then divided by a goal of 2%. At 2% or more the score is 100; at 1% it is 50; at no aid it is 0.",
      ],
    },
    {
      id: "family-index",
      heading: "Index already on 0 to 100",
      body: [
        "Five sources already publish a 0 to 100 score where higher is better: essential health service coverage, health regulation capacity, sustainable agriculture, government effectiveness and the macro-economic performance index. The score is that value, with no benchmark.",
      ],
    },
    {
      id: "family-bands",
      heading: "Density bands",
      body: [
        "Population density is sorted into five bands: 250 or more people per square km scores 0, 100 to 249 scores 25, 75 to 99 scores 50, 25 to 74 scores 75, and below 25 scores 100. Denser means more need. The client confirmed this direction.",
        "An earlier smooth formula pushed almost every country to the same value, so it was replaced.",
      ],
    },
    {
      id: "drift",
      heading: "Where the catalogue and the scoring disagree",
      body: [
        "The 2026-10-15 audit compared the written indicator catalogue with the scoring itself. This table follows the scoring, because that is what produces the numbers. Three readings wait on the client.",
        "Renewable energy: the catalogue describes a goal of 20% renewable share. The scoring treats 20 points as the allowed shortfall, an 80% benchmark.",
        "Family planning: the benchmark of 11.5 is read as a shortfall, so 88.5% of demand met is the benchmark.",
        "Aid to agriculture: aid is in constant 2022 dollars and national income is in current dollars, and the ratio mixes the two.",
      ],
    },
  ],
  dashboardLink: { label: "Open Explore", to: "/explore" },
  provenance: {
    updated: "2026-10-15",
    decisionIds: ["population-density", "renewables-benchmark", "contraception-benchmark", "aid-income-basis"],
  },
};
