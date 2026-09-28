import type { IndicatorStatus, IndicatorStatusValue } from "../data/contract/types";

/**
 * Data-honesty copy for missing / deferred indicators.
 *
 * The dashboard must never coerce a missing observation to 0 and must explain
 * *why* a score is blank. There are two distinct kinds of "blank":
 *
 *  1. Deferred / excluded BY DESIGN — the indicator will not appear regardless
 *     of how fresh the published snapshot is, because its methodology is open
 *     (`conces`) or its scorer is unresolved (`popdens`). These have a fixed,
 *     authoritative explanation sourced from `indicators/SCORING_AUDIT.md` and
 *     `docs/source-candidates.md`.
 *
 *  2. Absent from THIS snapshot — the indicator is wired in the pipeline but the
 *     contract JSON currently loaded has no value for the selected countries
 *     (e.g. a dry-run payload that predates a source going live). This is a
 *     generic, snapshot-relative message, computed from the data rather than
 *     hard-coded per indicator.
 *
 * Keep these keyed by the contract `indicator.key` / `pillar.key` so they stay
 * correct as the published snapshot updates.
 */

/** Indicators that are intentionally absent and will stay absent until upstream methodology work lands. */
export const DEFERRED_INDICATORS: Record<string, string> = {
  // pri / macrosec — was the only indicator in "Socio-economic performance" pillar.
  // NOTE: As of 2026-06-01 the pipeline replaced `conces` with `hdi` (UNDP Human Development Index).
  // Keep this entry until meta.json is republished and `conces` no longer appears in contract indicators.
  conces:
    "The Concessionality Index is a PlanCatalyst-defined composite with no finalized methodology yet, so it is intentionally left blank rather than estimated. (Deferred by design — see scoring audit.)",
  // ctx / ctxmisc — banded scorer is live; semantic direction pending PlanCatalyst sign-off.
  popdens:
    "Population density uses a banded scoring formula. Whether it contributes to the context pillar score or is display-only is pending client confirmation — see scoring audit.",
};

/**
 * Copy for contract §3.1 `indicatorStatus`. A null with a status is not a
 * generic gap: `out_of_scope` is a correct, permanent absence and
 * `incomplete_data` is a gap someone may need to chase. Keyed by status value,
 * not indicator, so any indicator that gains a status model reuses it.
 */
export const INDICATOR_STATUS_COPY: Record<IndicatorStatusValue, string> = {
  scored: "",
  out_of_scope:
    "Not in scope for this index. The country is not an IBRD, IDA or blend borrower, so it does not report the debt data the index is built from. This is not a data gap.",
  incomplete_data:
    "In scope, but one or more components have no data in any published year. No partial score is computed.",
};

/** Human labels for `missingComponents` identifiers (mspi). Unknown identifiers fall back to the raw key. */
export const MSPI_COMPONENT_LABELS: Record<string, string> = {
  income: "income",
  fragility: "governance and fragility",
  debt_risk: "debt risk",
  concessionality: "debt concessionality",
};

export function describeIndicatorStatus(status: IndicatorStatus | null | undefined): string | null {
  if (!status || status.status === "scored") return null;
  const base = INDICATOR_STATUS_COPY[status.status] ?? NO_DATA_IN_SNAPSHOT;
  if (status.status !== "incomplete_data" || status.missingComponents.length === 0) return base;
  const parts = status.missingComponents.map((c) => MSPI_COMPONENT_LABELS[c] ?? c);
  return `${base} Missing: ${parts.join(", ")}.`;
}

/**
 * Short footnote for the Explore table explaining what — means and why many pillar columns
 * are sparse in the current snapshot.
 */
export const EXPLORE_TABLE_FOOTNOTE =
  "— means missing data, not zero. Pillar scores reflect the published contract; some pillars are sparse or empty in the current snapshot. Ranking on a sparse column only reflects countries that have data.";

/** Generic, snapshot-relative message for a pillar that has no data for the current selection. */
export const NO_DATA_FOR_SELECTION =
  "Not available for the selected countries in this data snapshot.";

/** Generic message for a pillar with no data anywhere in the loaded snapshot. */
export const NO_DATA_IN_SNAPSHOT =
  "Not available in the current data snapshot.";

/**
 * Shared score-interpretation footnote shown on Map, Explore, and Compare so the
 * reading of every score is consistent across the product. Higher = more
 * favourable (lower need); partial coverage can inflate a sparse latest year;
 * the index is a need signal, not a conflict measure.
 */
export const SCORE_INTERPRETATION_NOTE =
  "Scores are 0–100, higher = more favourable (lower development need). Need bands: 75–100 LOW · 50–74 MODERATE · 25–49 HIGH · 0–24 SEVERE. LATEST = published value for the most recent year with data; ALL YEARS = client-side estimate when no published value exists. Partial coverage can inflate a sparse latest year (see the confidence flag). This index measures development need, not conflict.";

/** Compact one-liner for tight spaces (map legend, card footers). */
export const SCORE_INTERPRETATION_NOTE_SHORT =
  "Higher = more favourable (lower need). Partial coverage may inflate sparse years; index does not measure conflict.";

/**
 * If every indicator under a pillar/subdomain is deferred-by-design, return the
 * authoritative explanation; otherwise null (caller falls back to a generic
 * snapshot-relative note). `indicatorKeys` are the contract indicator keys that
 * roll up into the pillar/subdomain being rendered.
 */
export function deferredNoteForIndicators(indicatorKeys: string[]): string | null {
  if (indicatorKeys.length === 0) return null;
  const deferred = indicatorKeys.filter((k) => k in DEFERRED_INDICATORS);
  if (deferred.length === 0) return null;
  if (deferred.length !== indicatorKeys.length) return null;
  // All indicators are deferred-by-design: surface the (deduped) explanations.
  return deferred.map((k) => DEFERRED_INDICATORS[k]).join(" ");
}
