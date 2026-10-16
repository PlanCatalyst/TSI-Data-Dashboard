/**
 * The gallery of chart oddities in section 8. Each entry names a real series
 * in the published contract, drawn live as a sparkline, with its cause and
 * whether it is a property of the data, a rule we chose, or an open issue.
 */

export type OddityKind = "data" | "rule" | "open";

export type OddityViz =
  /** A published indicator series for one country. */
  | { type: "series"; iso3: string; indicator: string }
  /** A basket-rule pillar series for one country. */
  | { type: "pillar"; iso3: string; pillar: string }
  /** How many of a pillar's indicators have a value each year. */
  | { type: "indicator-count"; iso3: string; pillar: string }
  /** How many of the six core pillars have a score each year. */
  | { type: "pillar-count"; iso3: string }
  /** Share of a region's countries that report an indicator each year. */
  | { type: "region-share"; region: string; indicator: string }
  /** How many countries report an indicator each year. */
  | { type: "country-count"; indicator: string };

export type Oddity = {
  id: string;
  title: string;
  kind: OddityKind;
  symptom: string;
  cause: string;
  viz: OddityViz;
  /** Decision that explains it, for the status chip. */
  decisionId: string;
  /** Section with the full explanation. */
  section: string;
  /** Where the link opens on the dashboard. */
  link: { to: string; label: string };
  /** Caption under the chart. */
  caption: string;
};

export const KIND_LABEL: Record<OddityKind, string> = {
  data: "Property of the data",
  rule: "Rule we chose",
  open: "Open issue",
};

export const ODDITIES: Oddity[] = [
  {
    id: "flat-at-100",
    title: "A line sits flat at 100 for years",
    kind: "rule",
    symptom: "Brazil's climate score is 100 in every year, even though the source value keeps moving.",
    cause:
      "Brazil is better than our benchmark for climate vulnerability every year, and every country past the benchmark gets the same top score.",
    viz: { type: "series", iso3: "BRA", indicator: "ndgain" },
    decisionId: "benchmark-rule",
    section: "flat-at-100",
    link: { to: "/map?country=BRA", label: "Open Brazil on the map, then Climate adaptation" },
    caption: "Brazil, climate vulnerability score, all years",
  },
  {
    id: "small-country",
    title: "One small country's line jumps around",
    kind: "data",
    symptom: "Palau's tuberculosis score jumps between low and 100 from one year to the next.",
    cause:
      "With a population of a few thousand, a handful of cases moves the rate by hundreds per 100,000. The numbers are real.",
    viz: { type: "series", iso3: "PLW", indicator: "tb" },
    decisionId: "small-populations",
    section: "odd-charts",
    link: { to: "/map?country=PLW", label: "Open Palau on the map, then Healthcare" },
    caption: "Palau, tuberculosis incidence score",
  },
  {
    id: "jagged-aid",
    title: "Agriculture aid is jagged",
    kind: "data",
    symptom: "Dominica's agriculture aid score rises and falls sharply year to year.",
    cause:
      "Aid is paid out in lumps. A large payment one year and a small one the next is how the money actually arrives.",
    viz: { type: "series", iso3: "DMA", indicator: "agoda" },
    decisionId: "lumpy-aid",
    section: "odd-charts",
    link: { to: "/map?country=DMA", label: "Open Dominica on the map, then Agriculture" },
    caption: "Dominica, agriculture aid score",
  },
  {
    id: "starts-late",
    title: "A series starts late or stops early",
    kind: "data",
    symptom: "Brazil's health emergency preparedness score exists only from 2010 to 2017.",
    cause:
      "That is all the source published. The same happens with water and sanitation deaths (2019 only), governance (every other year before 2002) and poverty surveys (survey years only).",
    viz: { type: "series", iso3: "BRA", indicator: "ihr" },
    decisionId: "refresh-cycle",
    section: "sources",
    link: { to: "/map?country=BRA", label: "Open Brazil on the map, then Healthcare" },
    caption: "Brazil, health emergency preparedness score",
  },
  {
    id: "no-early-years",
    title: "A pillar has no early years",
    kind: "rule",
    symptom: "Brazil's agriculture pillar has no score before 2015.",
    cause:
      "We score a pillar only when 75% of its indicators have a value. Brazil's agriculture indicators did not all report before 2015.",
    viz: { type: "pillar", iso3: "BRA", pillar: "ag" },
    decisionId: "basket-rule",
    section: "pillars",
    link: { to: "/map?country=BRA", label: "Open Brazil on the map, then Agriculture" },
    caption: "Brazil, agriculture pillar score",
  },
  {
    id: "regional-gaps",
    title: "A regional line has gaps",
    kind: "rule",
    symptom: "The regional line for Western and Central Africa starts years later than the data does.",
    cause:
      "We skip years when fewer than half of a region's countries report, because a handful of early reporters would stand in for the whole region.",
    viz: { type: "region-share", region: "afw", indicator: "gii" },
    decisionId: "regional-gaps",
    section: "odd-charts",
    link: { to: "/explore", label: "Open Explore and pick Africa Western & Central" },
    caption: "Western and Central Africa, share of countries reporting gender inequality",
  },
  {
    id: "n-of-m",
    title: "A pillar score marked \"1 of 3\"",
    kind: "rule",
    symptom: "A pillar score carries a badge saying how many of its indicators back it.",
    cause:
      "The badge counts indicators with a value. Brazil's agriculture pillar has three indicators, and it only recently began to have all of them.",
    viz: { type: "indicator-count", iso3: "BRA", pillar: "ag" },
    decisionId: "indicator-count-badge",
    section: "pillars",
    link: { to: "/map?country=BRA", label: "Open Brazil on the map, then Agriculture" },
    caption: "Brazil, agriculture indicators with a value each year (of 3)",
  },
  {
    id: "dense-zero",
    title: "Dense countries score 0 on population density",
    kind: "rule",
    symptom: "Bangladesh scores 0 on population density.",
    cause:
      "We score density in bands, and denser means more need. Above 250 people per square km the score is 0. We confirmed this direction.",
    viz: { type: "series", iso3: "BGD", indicator: "popdens" },
    decisionId: "population-density",
    section: "scoring",
    link: { to: "/map?country=BGD", label: "Open Bangladesh on the map, then Country context" },
    caption: "Bangladesh, population density score",
  },
  {
    id: "few-countries",
    title: "Sustainable agriculture shows only a handful of countries",
    kind: "data",
    symptom: "Almost every country is blank for sustainable agriculture.",
    cause: "The source reports for about ten countries, starting in 2020.",
    viz: { type: "country-count", indicator: "susag" },
    decisionId: "refresh-cycle",
    section: "missing-data",
    link: { to: "/explore", label: "Open Explore and sort by Agriculture" },
    caption: "Countries reporting sustainable agriculture, by year",
  },
  {
    id: "overall-blank",
    title: "No overall score even though most pillars have one",
    kind: "rule",
    symptom: "A country shows scores for most pillars but a dash for its overall score.",
    cause:
      "We show an overall score only when the six core pillars all have a score. Brazil has all six from 2015 to 2023, and fewer in the latest year, when some sources have not published yet.",
    viz: { type: "pillar-count", iso3: "BRA" },
    decisionId: "overall-core-pillars",
    section: "missing-data",
    link: { to: "/map?country=BRA", label: "Open Brazil on the map" },
    caption: "Brazil, core pillars with a score each year (of 6)",
  },
];
