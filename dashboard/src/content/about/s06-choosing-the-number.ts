import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "choosing-the-number",
  number: 6,
  title: "Which figure we use",
  keywords: ["rows", "disaggregation", "sex", "age", "urban", "national", "totals", "sawtooth", "adolescent", "country code", "survey", "aid", "gdp"],
  answer: [
    "Sources often publish several rows for one country and year, split by sex, age or area. We use the national total, or the one group the benchmark was written for.",
    "If a source gives only a city figure for a year, we show no value for that year. We never pass a city number off as the national one.",
  ],
  detail: [
    {
      id: "selection-rules",
      heading: "Our rules, indicator by indicator",
      body: [
        "Adolescent births use girls aged 15 to 19, which is the definition behind the benchmark. Health emergency preparedness is the average of its 13 capacities. Bank accounts use adults aged 15 and over. Measures about women only, such as maternal mortality, anemia and family planning, use the women's figure.",
        "Everywhere else we use the total for both sexes, all ages and all areas.",
      ],
    },
    {
      id: "urban-only",
      heading: "City-only figures",
      body: [
        "For some countries and years the UN database reports only an urban figure for water, sanitation or poverty. Urban figures are usually better than national ones, so using them would flatter the country and change the measure partway along a line.",
        "So if a series reports a national total anywhere, we score only national totals for that series. This corrected 482 country-years in 22 countries.",
      ],
    },
    {
      id: "aid-income",
      heading: "Aid needs national income",
      body: [
        "We score agriculture aid as a share of national income. Where a country had no income figure, we used to score the raw dollar amount against a percentage goal, and it always looked like a perfect score. Now we show no value instead.",
      ],
    },
    {
      id: "codes-and-labels",
      heading: "Country codes and survey labels",
      body: [
        "One governance source still uses a retired code for Andorra, so its series did not reach the dashboard. We now map a short list of retired codes to current ones. One poverty survey wave was labelled as a year range and was dropped without notice. We now read range labels, and we log any label we cannot read.",
      ],
    },
    {
      id: "new-splits",
      heading: "A split we have no rule for",
      body: [
        "If a source adds a new split we have no rule for, we stop and look at it. We never pick a row at random.",
      ],
    },
  ],
  dashboardLink: { label: "See Brazil on the map", to: "/map?country=BRA" },
  provenance: {
    updated: "2026-10-15",
    decisionIds: ["one-row-per-year", "national-totals-only", "aid-needs-gdp", "country-codes", "survey-years"],
  },
};
