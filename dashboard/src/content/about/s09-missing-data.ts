import type { SectionContent } from "./types";

/** The five forecast gates, with the thresholds the forecasting code uses. */
export const GATES: { id: string; name: string; test: string }[] = [
  { id: "observations", name: "Enough observations", test: "At least 8 yearly values." },
  { id: "span", name: "Long enough", test: "The first and last value are at least 8 years apart." },
  { id: "stale", name: "Recent enough", test: "The last value is no more than 3 years old." },
  { id: "sparse", name: "Not too sparse", test: "No more than 40% of the years in its span are missing." },
  { id: "signal", name: "Has a signal", test: "The values are not a flat line." },
];

export const section: SectionContent = {
  id: "missing-data",
  number: 9,
  title: "Missing data and projections",
  keywords: ["missing", "blank", "null", "out of scope", "incomplete", "projection", "forecast", "gates", "coverage", "heatmap", "dash"],
  answer: [
    "A blank has two meanings. Out of scope means the measure does not apply to that country. Incomplete data means it applies, but an input is missing, so no partial score is made.",
    "Projections are off in this release. When on, a series must pass five quality gates, and the last value is never carried forward as a forecast.",
  ],
  detail: [
    {
      id: "blank-kinds",
      heading: "Out of scope versus incomplete data",
      body: [
        "Out of scope is permanent and correct. For example, the macro-economic index is built from debt data that only World Bank borrowers report, so a country outside that group has no score and is not missing anything.",
        "Incomplete data is a gap someone may want to chase: the country is in scope, but one or more inputs have no value in any year. The dashboard names the missing input and computes nothing from the rest.",
      ],
    },
    {
      id: "overall-blank",
      heading: "A blank overall score",
      body: [
        "The overall score is blank unless all seven pillars have a score for that year. Showing an average of fewer pillars would look as solid as a full one and would not be comparable between countries.",
      ],
    },
    {
      id: "projections",
      heading: "Why projections are off",
      body: [
        "A forecast built on a short, old or noisy series is worse than none for a decision-support tool. The forecasting code is built and tested, and the published data currently carries no projections.",
        "When switched on, each country and indicator must pass the five gates in the diagram above. A series that fails shows \"Forecast unavailable due to insufficient information\" and nothing else. The last value is never repeated forward to fill the gap.",
      ],
    },
    {
      id: "coverage",
      heading: "Reading the coverage chart",
      body: [
        "The coverage chart shows, for each indicator and year, what share of countries report. Dark means most countries, pale means few, and white means none. It is a map of where the data is thin, and it explains most of the late starts and early stops on the dashboard.",
      ],
    },
  ],
  dashboardLink: { label: "Open Explore", to: "/explore" },
  provenance: {
    updated: "2026-10-15",
    decisionIds: ["projections-off", "aid-gdp-source", "overall-needs-all-pillars"],
  },
};
