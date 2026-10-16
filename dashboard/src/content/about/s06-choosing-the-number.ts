import type { SectionContent } from "./types";

export const section: SectionContent = {
  id: "choosing-the-number",
  number: 6,
  title: "Choosing the right number from the source",
  keywords: ["rows", "disaggregation", "sex", "age", "urban", "national", "totals", "sawtooth", "adolescent", "country code", "survey", "aid", "gdp"],
  answer: [
    "Sources often publish several rows for one country and year, split by sex, age or area. We keep the national total, or the one population group the benchmark was written for.",
    "If a source gives only an urban figure for a year, that year shows no value. A city number is never passed off as the national one.",
  ],
  detail: [
    {
      id: "selection-rules",
      heading: "The rules, indicator by indicator",
      body: [
        "Adolescent births use girls aged 15 to 19, which is the definition behind the benchmark. Health regulation capacity is the mean of its 13 capacities. Bank accounts use adults aged 15 and over. Measures that are about women only, such as maternal mortality, anaemia and family planning, use the women's figure.",
        "Everywhere else, the total for both sexes, all ages and all areas.",
      ],
    },
    {
      id: "urban-only",
      heading: "City-only figures",
      body: [
        "For some countries and years the UN database reports only an urban figure for water, sanitation or poverty. Urban figures are usually better than national ones, so using them flatters the country and changes the measure partway along a line.",
        "If a series reports a national total anywhere, only national totals are scored for that series. 482 country-years in 22 countries were corrected this way.",
      ],
    },
    {
      id: "aid-income",
      heading: "Aid needs national income",
      body: [
        "Agriculture aid is scored as a share of national income. Where a country has no income figure, the raw dollar amount was scored against a percentage goal and always read as a perfect score. It now shows no value instead.",
      ],
    },
    {
      id: "codes-and-labels",
      heading: "Country codes and survey labels",
      body: [
        "One governance source still uses a retired code for Andorra, so its series did not reach the dashboard. A short list of retired codes is now mapped to current ones. One poverty survey wave was labelled as a year range and was dropped silently. Range labels are now read, and any label that cannot be read is logged.",
      ],
    },
    {
      id: "new-splits",
      heading: "A split no rule covers",
      body: [
        "If a source adds a new split the rules do not cover, the run stops. It never picks a row at random.",
      ],
    },
  ],
  dashboardLink: { label: "See Brazil on the map", to: "/map?country=BRA" },
  provenance: {
    updated: "2026-10-15",
    decisionIds: ["one-row-per-year", "national-totals-only", "aid-needs-gdp", "country-codes", "survey-years"],
  },
};
