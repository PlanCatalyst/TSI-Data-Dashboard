import type { Decision, DecisionStatus } from "./types";

/**
 * Every material pipeline data decision, in one place (REQ9.12). The status
 * chips in each section and the log in section 12 read from this list, so a
 * decision changes here and nowhere else. Entries name no people or roles.
 */

/**
 * How candid the public page is about open issues (requirements Q9.1).
 *   full        cause, status and the internal issue id
 *   summarised  cause and status, no issue ids (build default)
 *   hidden      entries that are not yet decided are left out of the log
 * Reyna approves the level before release; changing it is this one line.
 */
export type Candour = "full" | "summarised" | "hidden";
export const CANDOUR: Candour = "summarised";

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  locked: "Locked",
  pending: "Pending client decision",
  open: "Open issue",
};

export const DECISIONS: Decision[] = [
  {
    id: "benchmark-rule",
    title: "Countries better than the benchmark all score 100",
    consideration:
      "Each indicator is scored against a benchmark the client supplied. A country already past the benchmark has no gap left to measure.",
    decision:
      "Today those countries score 100 and tie, so their lines run flat. A softer rule is built and switched off: it keeps the benchmark as the 75 mark and spreads better countries between 75 and 100.",
    why: "Keeping the client's benchmark framing was the first priority, but the tie hides real improvement. The client chooses between keeping the rule, the soft floor, or ranking every country against the others.",
    date: "2026-10-14",
    status: "pending",
    issues: ["DQ-01"],
    section: "flat-at-100",
  },
  {
    id: "one-row-per-year",
    title: "One source row per country, indicator and year",
    consideration:
      "Sources publish several rows for the same country and year, split by sex, age or area. Picking one at random made some lines jump up and down.",
    decision:
      "National totals only. Adolescent births use ages 15 to 19, health regulation capacity is the mean of its 13 capacities, bank accounts use adults 15 and over. A split no rule covers stops the publish.",
    why: "The benchmark for each indicator is written for one specific population. Scoring a different slice gives a number that looks right and means something else.",
    date: "2026-10-14",
    status: "locked",
    issues: ["DQ-02"],
    section: "choosing-the-number",
  },
  {
    id: "national-totals-only",
    title: "City-only rows are never shown as national",
    consideration:
      "For some countries and years a source reports only an urban figure for water, sanitation or poverty.",
    decision:
      "If a series reports a national total anywhere, only national totals are scored. A year with only an urban row shows no value. Series that are about women only keep the women's figure.",
    why: "An urban figure is usually better than the national one, so using it flatters the country and changes the measure mid-line.",
    date: "2026-10-15",
    status: "locked",
    issues: ["DQ-11"],
    section: "choosing-the-number",
  },
  {
    id: "basket-rule",
    title: "Pillar scores use a fixed basket of indicators",
    consideration:
      "Averaging whatever reported in a given year changes which indicators are in the average from year to year, so lines zigzag.",
    decision:
      "An indicator counts toward a pillar if it reported in the last five years. A year is scored only when at least 75% of that basket is present. Years short of that show no score.",
    why: "A line should move because the country moved, not because a different set of indicators happened to report. The cost is that early years with thin data disappear.",
    date: "2026-10-14",
    status: "locked",
    issues: ["DQ-03"],
    section: "pillars",
  },
  {
    id: "regional-gaps",
    title: "Regional lines skip years with thin coverage",
    consideration:
      "In early years only a few countries in a region report, and a regional average of those few is misleading.",
    decision:
      "A regional line is drawn only for years when at least half of the region's countries report. A note under the chart says so.",
    why: "A line that ramps up and then drops looks like a real change when it is only more countries joining the average.",
    date: "2026-10-14",
    status: "locked",
    issues: ["DQ-04"],
    section: "odd-charts",
  },
  {
    id: "indicator-count-badge",
    title: "Show how many indicators back a pillar score",
    consideration:
      "A pillar score can rest on one indicator out of several, and swings when that one source changes.",
    decision:
      "Rows resting on fewer indicators than the full set carry an \"n of m\" badge. Hiding such scores entirely is not done.",
    why: "Readers can judge the weight of a score themselves. A minimum-coverage rule would hide whole pillars for many countries, which is a client decision.",
    date: "2026-10-14",
    status: "open",
    issues: ["DQ-05"],
    section: "pillars",
  },
  {
    id: "no-invented-scores",
    title: "A missing value never becomes a score",
    consideration:
      "A missing source value was once read as \"better than the benchmark\" and published as 100.",
    decision:
      "Missing stays missing from source to screen. A score with no value behind it, or outside 0 to 100, stops the publish.",
    why: "A zero or a perfect score for a country with no data is a false statement about that country.",
    date: "2026-10-14",
    status: "locked",
    issues: ["DQ-06"],
    section: "checks",
  },
  {
    id: "aid-needs-gdp",
    title: "Agriculture aid is scored only where national income is known",
    consideration:
      "Aid is measured as a share of national income. Where income is missing, the raw dollar amount was scored as if it were a share.",
    decision:
      "No income figure, no aid score. Whether to borrow income from another source for those countries is a separate question.",
    why: "A raw dollar amount compared with a percentage goal always reads as a perfect score. Showing no value is the honest result.",
    date: "2026-10-15",
    status: "locked",
    issues: ["DQ-10"],
    section: "choosing-the-number",
  },
  {
    id: "aid-gdp-source",
    title: "Another income source for countries without one",
    consideration:
      "A few countries (for example North Korea, Eritrea, South Sudan, Yemen and Cuba in recent years) have no national income figure in the current source.",
    decision:
      "They show no agriculture aid score for now. Using another income source would fill them in.",
    why: "It needs the client to accept figures from a second source.",
    date: "2026-10-15",
    status: "pending",
    issues: ["DQ-10"],
    section: "missing-data",
  },
  {
    id: "country-codes",
    title: "Retired country codes map to current ones",
    consideration:
      "One governance source still uses an old code for Andorra, so its series did not reach the dashboard.",
    decision:
      "A short list of retired codes is mapped to current ISO codes before anything is joined.",
    why: "A country should not lose a whole series because of a label.",
    date: "2026-10-15",
    status: "locked",
    issues: ["DQ-12"],
    section: "choosing-the-number",
  },
  {
    id: "survey-years",
    title: "Survey waves written as year ranges are kept",
    consideration:
      "One poverty survey wave was labelled in a short range format and was dropped silently.",
    decision:
      "Range labels are read and filed under the survey's end year. Any label the reader cannot parse is logged, never dropped quietly.",
    why: "Each survey wave is rare and valuable for a source that only publishes in survey years.",
    date: "2026-10-15",
    status: "locked",
    issues: ["DQ-13"],
    section: "choosing-the-number",
  },
  {
    id: "overall-needs-all-pillars",
    title: "Overall score appears only when all seven pillars have a score",
    consideration:
      "Averaging only the pillars that exist gives a country with many gaps an overall score that looks as solid as a complete one.",
    decision:
      "The overall score is blank unless every pillar has a score for that year. The pillar scores underneath still show.",
    why: "An overall number should mean the same thing for every country that has one.",
    date: "2026-10-15",
    status: "locked",
    issues: [],
    section: "missing-data",
  },
  {
    id: "population-density",
    title: "Population density is scored in bands",
    consideration:
      "A smooth scale pushed almost every country to the top or bottom, which made the score nearly constant.",
    decision:
      "Five bands from 0 to 100, where denser means more need. Direction confirmed by the client.",
    why: "The client's framework defines density as bands, and the banded scale actually separates countries.",
    date: "2026-09-17",
    status: "locked",
    issues: [],
    section: "scoring",
  },
  {
    id: "renewables-benchmark",
    title: "Renewable energy benchmark",
    consideration:
      "The indicator catalogue describes a goal of 20% renewable energy. The scoring code treats 20 points as the allowed shortfall, which is an 80% benchmark.",
    decision:
      "The scores use the code's reading, 80%. Nothing changes until the client says which was meant.",
    why: "The two readings give very different scores for most countries, so the choice needs the client.",
    date: "2026-10-15",
    status: "pending",
    issues: [],
    section: "scoring",
  },
  {
    id: "contraception-benchmark",
    title: "Family planning benchmark",
    consideration:
      "The benchmark of 11.5 for family planning demand satisfied could be a level or a shortfall.",
    decision: "The scoring code treats it as a shortfall, which makes the benchmark 88.5% of demand met.",
    why: "The catalogue does not say which reading was meant.",
    date: "2026-10-15",
    status: "pending",
    issues: [],
    section: "scoring",
  },
  {
    id: "aid-income-basis",
    title: "Agriculture aid measured against national income",
    consideration:
      "Aid is in constant 2022 dollars, national income is in current dollars. Dividing one by the other mixes price levels.",
    decision: "Shown as the ratio of the two. Adjusting income to constant dollars is the alternative.",
    why: "The client's framework describes the ratio but not the price basis.",
    date: "2026-10-15",
    status: "pending",
    issues: [],
    section: "scoring",
  },
  {
    id: "debt-risk-input",
    title: "Debt risk with a missing input",
    consideration:
      "The macro-economic index rates debt risk from three ratios. When one ratio is missing, using the others can only make risk look lower.",
    decision:
      "15 country-years currently score from a partial set. The recommended rule is to require all three ratios and show no score otherwise.",
    why: "The index specification does not say what to do. A partial score biases toward the safe side.",
    date: "2026-10-15",
    status: "pending",
    issues: ["DQ-14"],
    section: "checks",
  },
  {
    id: "lumpy-aid",
    title: "Agriculture aid flows are jagged in some countries",
    consideration:
      "Aid is paid out in lumps, so the score rises and falls year to year in a handful of countries.",
    decision:
      "Shown as published. A three-year average before scoring is a candidate treatment.",
    why: "The pattern comes from the data, not from processing, and smoothing would change the client's measure.",
    date: "2026-10-15",
    status: "open",
    issues: ["DQ-08"],
    section: "odd-charts",
  },
  {
    id: "small-populations",
    title: "Rates in very small countries swing",
    consideration:
      "With a population of a few thousand, a handful of cases moves a rate by hundreds per 100,000.",
    decision:
      "Shown as published. A minimum-population rule for rate-based indicators is a candidate treatment.",
    why: "The numbers are real. Hiding small countries would remove them from the picture.",
    date: "2026-10-15",
    status: "open",
    issues: ["DQ-09"],
    section: "odd-charts",
  },
  {
    id: "projections-off",
    title: "No projections in this release",
    consideration:
      "Forecasts need long, recent, steady series. Many series fail at least one of those tests.",
    decision:
      "Projections are switched off. When on, a series must pass five quality gates, and the last value is never carried forward as a forecast.",
    why: "A forecast built on thin data is worse than no forecast for a decision-support tool.",
    date: "2026-10-15",
    status: "locked",
    issues: [],
    section: "missing-data",
  },
  {
    id: "refresh-cycle",
    title: "Data refreshes every six months",
    consideration: "How often the numbers are rebuilt and republished.",
    decision: "Twice a year, by hand, after a full set of checks. Nothing refreshes automatically.",
    why: "The sources publish annually or less often, and each refresh is checked against the raw files before it goes live.",
    date: "2026-07-07",
    status: "locked",
    issues: [],
    section: "sources",
  },
];

const RANK: Record<DecisionStatus, number> = { locked: 0, pending: 1, open: 2 };

export function decisionById(id: string): Decision | undefined {
  return DECISIONS.find((d) => d.id === id);
}

/** Decisions the page may show, given the candour level. */
export function visibleDecisions(candour: Candour = CANDOUR): Decision[] {
  return candour === "hidden" ? DECISIONS.filter((d) => d.status === "locked") : DECISIONS;
}

/** Issue ids to print next to an entry; empty unless candour is "full". */
export function visibleIssues(d: Decision, candour: Candour = CANDOUR): string[] {
  return candour === "full" ? d.issues : [];
}

/** Worst status among a section's decisions, or null when it rests on none. */
export function sectionStatus(ids: string[], candour: Candour = CANDOUR): DecisionStatus | null {
  const list = ids
    .map(decisionById)
    .filter((d): d is Decision => d !== undefined)
    .filter((d) => candour !== "hidden" || d.status === "locked");
  if (list.length === 0) return null;
  return list.reduce<DecisionStatus>((worst, d) => (RANK[d.status] > RANK[worst] ? d.status : worst), "locked");
}
