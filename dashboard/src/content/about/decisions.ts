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
 * The level is set before release; changing it is this one line.
 */
export type Candour = "full" | "summarised" | "hidden";
export const CANDOUR: Candour = "hidden";

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  locked: "Locked",
  pending: "Decision pending",
  open: "Open issue",
};

export const DECISIONS: Decision[] = [
  {
    id: "benchmark-rule",
    title: "Countries past the benchmark spread out, not all at 100",
    consideration: "Each indicator is scored against a benchmark. A country already past the benchmark had no gap left to measure, so every such country used to score 100 and tie.",
    decision: "A country right at the benchmark sits near 75. Better countries spread upward from there, with the best country on record at 100. The tie is gone; only the single best performer sits at the top.",
    why: "The tie hid real improvement past the benchmark. We chose this over ranking every country against every other, since it keeps our benchmark framing while still showing differences between better performers.",
    date: "2026-11-03",
    status: "locked",
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
    decision: "Rows resting on fewer indicators than the full set carry an \"n of m\" badge. We do not hide those scores, and we will not add a minimum-coverage rule that would.",
    why: "You can judge the weight of a score yourself. A minimum-coverage rule would hide whole pillars for many countries, which is a bigger loss than a visible low-coverage badge.",
    date: "2026-11-03",
    status: "locked",
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
    title: "No second income source for countries without one",
    consideration: "A few countries (for example North Korea, Eritrea, South Sudan, Yemen and Cuba in recent years) have no national income figure in the current source.",
    decision: "They show no agriculture aid score. We will not pull income from a second source to fill them in.",
    why: "Mixing two income-measurement methods inside one ratio would make the ratio mean something different for those countries than for everyone else.",
    date: "2026-11-03",
    status: "locked",
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
    consideration: "Our indicator notes describe a goal of 20% renewable energy. The scoring treated 20 points as the allowed shortfall, which is an 80% benchmark.",
    decision: "The goal is a 20% renewable share. At or below it the score is 0; above it the score is one minus 20 divided by the share, scaled so the best country on record scores 100.",
    why: "Our framework sets 20% as the goal, and a higher share is already the better direction, so no flip is needed.",
    date: "2026-10-16",
    status: "locked",
    issues: [],
    section: "scoring",
  },
  {
    id: "contraception-benchmark",
    title: "Family planning benchmark",
    consideration: "The benchmark of 11.5 for family planning demand satisfied could be a level or a shortfall. The scoring treated it as a shortfall, which made the benchmark 88.5% of demand met.",
    decision: "The benchmark is the global average of 77.2% (2025 estimate, UN Population Division). At or below it the score is 0; above it the score is one minus 77.2 divided by the value, scaled so the best country on record scores 100.",
    why: "Our framework compares each country with the global average, and a higher share is already the better direction, so no flip is needed.",
    date: "2026-10-16",
    status: "locked",
    issues: [],
    section: "scoring",
  },
  {
    id: "aid-income-basis",
    title: "Agriculture aid measured against national income",
    consideration: "Aid is in constant 2022 dollars and national income was in current dollars. Dividing one by the other mixed price levels, so the ratio moved with inflation rather than with the real aid share.",
    decision: "National income is now rebased to the same constant 2022 dollars as the aid figure before the two are divided.",
    why: "Aid was already fixed to a single price year. Leaving income in current dollars let inflation move the ratio independent of whether the real aid share changed.",
    date: "2026-11-03",
    status: "locked",
    issues: [],
    section: "scoring",
  },
  {
    id: "debt-risk-input",
    title: "Debt risk requires all three inputs",
    consideration: "The macro-economic index rates debt risk from three ratios. When one ratio was missing, using the other two could only make risk look lower than the full picture supports.",
    decision: "A country-year needs all three ratios (external debt against national income, external debt against exports, and debt service against exports) to receive a debt-risk score. A country-year with only one or two ratios shows no score.",
    why: "A partial set of ratios leans toward the safe side by construction. No score is more honest than a falsely favourable partial one.",
    date: "2026-11-03",
    status: "locked",
    issues: ["DQ-14"],
    section: "checks",
  },
  {
    id: "lumpy-aid",
    title: "Agriculture aid flows are jagged in some countries",
    consideration: "Aid is paid out in lumps, so the score rises and falls from year to year in a handful of countries.",
    decision: "We show it as published, with no smoothing.",
    why: "The pattern comes from the data, not from our processing. Smoothing it would change the measure to something the source did not report.",
    date: "2026-11-03",
    status: "locked",
    issues: ["DQ-08"],
    section: "odd-charts",
  },
  {
    id: "small-populations",
    title: "Rates in very small countries swing",
    consideration: "With a population of a few thousand, a handful of cases moves a rate by hundreds per 100,000.",
    decision: "We show it as published. We will not apply a minimum-population rule.",
    why: "The numbers are real. Hiding small countries would remove them from the picture rather than explain what is in it.",
    date: "2026-11-03",
    status: "locked",
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
