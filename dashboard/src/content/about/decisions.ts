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
 * the reviewer approves the level before release; changing it is this one line.
 */
export type Candour = "full" | "summarised" | "hidden";
export const CANDOUR: Candour = "summarised";

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  locked: "Locked",
  pending: "Decision pending",
  open: "Open issue",
};

export const DECISIONS: Decision[] = [
  {
    id: "benchmark-rule",
    title: "Countries past the benchmark all score 100",
    consideration: "Each indicator is scored against a benchmark. A country already past the benchmark has no gap left to measure.",
    decision: "Today those countries score 100 and tie, so their lines run flat. We have built a softer rule and switched it off. It keeps the benchmark as 75 and spreads better countries between 75 and 100.",
    why: "We wanted to keep our benchmark framing, but the tie hides real improvement. We have not yet chosen between keeping the rule, the soft floor, or ranking every country against the others.",
    date: "2026-10-14",
    status: "pending",
    issues: ["DQ-01"],
    section: "flat-at-100",
  },
  {
    id: "one-row-per-year",
    title: "One source row per country, indicator and year",
    consideration: "Sources publish several rows for the same country and year, split by sex, age or area. Picking one at random made some lines jump up and down.",
    decision: "We use national totals only. Adolescent births use ages 15 to 19, health emergency preparedness is the average of its 13 capacities, and bank accounts use adults 15 and over. If a split has no rule, we stop and look at it.",
    why: "The benchmark for each indicator is written for one specific group. Scoring a different slice gives a number that looks right and means something else.",
    date: "2026-10-14",
    status: "locked",
    issues: ["DQ-02"],
    section: "choosing-the-number",
  },
  {
    id: "national-totals-only",
    title: "City-only rows are never shown as national",
    consideration: "For some countries and years a source reports only an urban figure for water, sanitation or poverty.",
    decision: "If a series reports a national total anywhere, we score only national totals. A year with only an urban row shows no value. Series that are about women only keep the women's figure.",
    why: "An urban figure is usually better than the national one, so using it would flatter the country and change the measure mid-line.",
    date: "2026-10-15",
    status: "locked",
    issues: ["DQ-11"],
    section: "choosing-the-number",
  },
  {
    id: "basket-rule",
    title: "Pillar scores use a fixed set of indicators",
    consideration: "Averaging whatever reported in a given year changes which indicators are in the average from year to year, so lines zigzag.",
    decision: "An indicator counts toward a pillar if it reported in the last five years. We score a year only when at least 75% of that set has a value. Years that fall short show no score.",
    why: "A line should move because the country moved, not because a different set of indicators happened to report. The cost is that early years with thin data disappear.",
    date: "2026-10-14",
    status: "locked",
    issues: ["DQ-03"],
    section: "pillars",
  },
  {
    id: "regional-gaps",
    title: "Regional lines skip years with thin coverage",
    consideration: "In early years only a few countries in a region report, and an average of those few is misleading.",
    decision: "We draw a regional line only for years when at least half of the region's countries report, and a note under the chart says so.",
    why: "A line that ramps up and then drops looks like a real change when it is only more countries joining the average.",
    date: "2026-10-14",
    status: "locked",
    issues: ["DQ-04"],
    section: "odd-charts",
  },
  {
    id: "indicator-count-badge",
    title: "We show how many indicators back a pillar score",
    consideration: "A pillar score can rest on one indicator out of several, and swing when that one source changes.",
    decision: "Rows resting on fewer indicators than the full set carry an \"n of m\" badge. We do not hide those scores.",
    why: "You can judge the weight of a score yourself. A minimum-coverage rule would hide whole pillars for many countries, and we have not decided to do that.",
    date: "2026-10-14",
    status: "open",
    issues: ["DQ-05"],
    section: "pillars",
  },
  {
    id: "no-invented-scores",
    title: "A missing value never becomes a score",
    consideration: "A missing source value was once read as \"better than the benchmark\" and published as 100.",
    decision: "Missing stays missing from the source to the screen. A score with no value behind it, or outside 0 to 100, stops the publish.",
    why: "A zero or a perfect score for a country with no data is a false statement about that country.",
    date: "2026-10-14",
    status: "locked",
    issues: ["DQ-06"],
    section: "checks",
  },
  {
    id: "aid-needs-gdp",
    title: "Agriculture aid is scored only where national income is known",
    consideration: "We measure aid as a share of national income. Where income is missing, the raw dollar amount was scored as if it were a share.",
    decision: "No income figure, no aid score. Whether to borrow income from another source for those countries is a separate question.",
    why: "A raw dollar amount compared with a percentage goal always reads as a perfect score. Showing no value is the honest result.",
    date: "2026-10-15",
    status: "locked",
    issues: ["DQ-10"],
    section: "choosing-the-number",
  },
  {
    id: "aid-gdp-source",
    title: "Another income source for countries without one",
    consideration: "A few countries (for example North Korea, Eritrea, South Sudan, Yemen and Cuba in recent years) have no national income figure in the current source.",
    decision: "They show no agriculture aid score for now. Using another income source would fill them in.",
    why: "We would need to accept figures from a second source, and we have not decided to.",
    date: "2026-10-15",
    status: "pending",
    issues: ["DQ-10"],
    section: "missing-data",
  },
  {
    id: "country-codes",
    title: "Retired country codes map to current ones",
    consideration: "One governance source still uses an old code for Andorra, so its series did not reach the dashboard.",
    decision: "We map a short list of retired codes to current ISO codes before anything is joined.",
    why: "A country should not lose a whole series because of a label.",
    date: "2026-10-15",
    status: "locked",
    issues: ["DQ-12"],
    section: "choosing-the-number",
  },
  {
    id: "survey-years",
    title: "Survey waves written as year ranges are kept",
    consideration: "One poverty survey wave was labelled in a short range format and was dropped without notice.",
    decision: "We read range labels and file them under the survey's end year. We log any label we cannot read instead of dropping it quietly.",
    why: "Each survey wave is rare and valuable for a source that only publishes in survey years.",
    date: "2026-10-15",
    status: "locked",
    issues: ["DQ-13"],
    section: "choosing-the-number",
  },
  {
    id: "overall-core-pillars",
    title: "Overall score needs the six core pillars",
    consideration: "An average of only the pillars that exist gives a country with many gaps an overall score that looks as solid as a complete one. Socio-economic performance is missing for about half the countries, because it only applies to World Bank borrowers.",
    decision: "The overall score is blank unless the six core pillars (healthcare, agriculture, social infrastructure, gender equality, climate adaptation and country context) all have a score. We include socio-economic performance in the average when a country has it. The pillar scores underneath still show.",
    why: "An overall number should mean the same thing for every country that has one. Requiring the borrower-only pillar would have blanked the overall score for rich countries that simply do not borrow.",
    date: "2026-10-15",
    status: "locked",
    issues: [],
    section: "missing-data",
  },
  {
    id: "population-density",
    title: "Population density is scored in bands",
    consideration: "A smooth scale pushed almost every country to the top or bottom, which made the score nearly constant.",
    decision: "Five bands from 0 to 100, where denser means more need. We confirmed this direction.",
    why: "Our framework defines density as bands, and bands separate countries far better than a smooth scale.",
    date: "2026-09-17",
    status: "locked",
    issues: [],
    section: "scoring",
  },
  {
    id: "renewables-benchmark",
    title: "Renewable energy benchmark",
    consideration: "Our indicator notes describe a goal of 20% renewable energy. The scoring treats 20 points as the allowed shortfall, which is an 80% benchmark.",
    decision: "The scores use the scoring's reading, 80%. Nothing changes until we confirm which was meant.",
    why: "The two readings give very different scores for most countries, so we want to be sure.",
    date: "2026-10-15",
    status: "pending",
    issues: [],
    section: "scoring",
  },
  {
    id: "contraception-benchmark",
    title: "Family planning benchmark",
    consideration: "The benchmark of 11.5 for family planning demand satisfied could be a level or a shortfall.",
    decision: "The scoring treats it as a shortfall, which makes the benchmark 88.5% of demand met.",
    why: "Our notes do not say which reading was meant.",
    date: "2026-10-15",
    status: "pending",
    issues: [],
    section: "scoring",
  },
  {
    id: "aid-income-basis",
    title: "Agriculture aid measured against national income",
    consideration: "Aid is in constant 2022 dollars and national income is in current dollars. Dividing one by the other mixes price levels.",
    decision: "We show the ratio of the two. Adjusting income to constant dollars is the alternative.",
    why: "Our framework describes the ratio but not the price basis.",
    date: "2026-10-15",
    status: "pending",
    issues: [],
    section: "scoring",
  },
  {
    id: "debt-risk-input",
    title: "Debt risk with a missing input",
    consideration: "The macro-economic index rates debt risk from three ratios. When one ratio is missing, using the others can only make risk look lower.",
    decision: "15 country-years currently score from a partial set. We recommend requiring all three ratios and showing no score otherwise.",
    why: "The index specification does not say what to do. A partial score leans toward the safe side.",
    date: "2026-10-15",
    status: "pending",
    issues: ["DQ-14"],
    section: "checks",
  },
  {
    id: "lumpy-aid",
    title: "Agriculture aid flows are jagged in some countries",
    consideration: "Aid is paid out in lumps, so the score rises and falls from year to year in a handful of countries.",
    decision: "We show it as published. A three-year average before scoring is one option.",
    why: "The pattern comes from the data, not from our processing, and smoothing would change the measure.",
    date: "2026-10-15",
    status: "open",
    issues: ["DQ-08"],
    section: "odd-charts",
  },
  {
    id: "small-populations",
    title: "Rates in very small countries swing",
    consideration: "With a population of a few thousand, a handful of cases moves a rate by hundreds per 100,000.",
    decision: "We show it as published. A minimum-population rule for rate-based indicators is one option.",
    why: "The numbers are real. Hiding small countries would remove them from the picture.",
    date: "2026-10-15",
    status: "open",
    issues: ["DQ-09"],
    section: "odd-charts",
  },
  {
    id: "projections-off",
    title: "No projections in this update",
    consideration: "Forecasts need long, recent, steady series. Many series fail at least one of those tests.",
    decision: "Projections are switched off. When on, a series must pass five quality checks, and we never carry the last value forward as a forecast.",
    why: "A forecast built on thin data is worse than no forecast for a tool that helps people decide where to look.",
    date: "2026-10-15",
    status: "locked",
    issues: [],
    section: "missing-data",
  },
  {
    id: "refresh-cycle",
    title: "Data updates every six months",
    consideration: "How often we rebuild and republish the numbers.",
    decision: "Twice a year, by hand, after a full set of checks. Nothing updates automatically.",
    why: "The sources publish once a year or less, and we check each update against the raw files before it goes live.",
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
