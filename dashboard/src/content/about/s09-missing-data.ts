import type { SectionContent } from "./types";

/** The five checks a series must pass to be forecast, with the thresholds the forecasting code uses. */
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
  title: "When data is missing",
  keywords: ["missing", "blank", "null", "out of scope", "incomplete", "projection", "forecast", "gates", "coverage", "heatmap", "dash"],
  answer: [
    "A blank can mean two things. Out of scope means the measure does not apply to that country. Incomplete data means it applies, but an input is missing, so we do not make a partial score.",
    "We have switched projections off for this update. When they are on, a series has to pass five quality checks, and we never carry the last value forward as a forecast.",
  ],
  detail: [
    {
      id: "blank-kinds",
      heading: "Out of scope versus incomplete data",
      body: [
        "Out of scope is permanent and correct. The macro-economic index, for example, is built from debt data that only World Bank borrowers report, so a country outside that group has no score and is not missing anything.",
        "Incomplete data is a gap worth chasing: the country is in scope, but one or more inputs have no value in any year. We name the missing input and compute nothing from the rest.",
      ],
    },
    {
      id: "overall-blank",
      heading: "A blank overall score",
      body: [
        "The overall score is blank unless the six core pillars all have a score. An average of fewer pillars would look as solid as a full one and could not be compared between countries. Socio-economic performance is the exception. It only applies to World Bank borrowers, so we include it when present and do not require it.",
      ],
    },
    {
      id: "projections",
      heading: "Why projections are off",
      body: [
        "A forecast built on a short, old or noisy series is worse than none for a tool that helps people decide where to look. We have built and tested forecasting, and the published data carries no projections for now.",
        "When we switch it on, each country and indicator must pass the five checks in the diagram above. A series that fails shows \"Forecast unavailable due to insufficient information\" and nothing else. We never repeat the last value forward to fill a gap.",
      ],
    },
    {
      id: "coverage",
      heading: "Reading the coverage chart",
      body: [
        "For each indicator and year, the chart shows what share of countries report. Dark means most countries, pale means few, and white means none. It shows where the data is thin, and it explains most of the late starts and early stops you see on the dashboard.",
      ],
    },
  ],
  dashboardLink: { label: "Open Explore", to: "/explore" },
  provenance: {
    updated: "2026-10-15",
    decisionIds: ["projections-off", "aid-gdp-source", "overall-core-pillars"],
  },
};
