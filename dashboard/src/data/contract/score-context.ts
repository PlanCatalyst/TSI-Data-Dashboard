import type {
  CountryPayload,
  MetaPayload,
  TimeseriesPayload,
} from "./types";
import { latestValue } from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// Score interpretability helpers (Phase 1 — frontend only).
//
// Single source of truth for how a 0–100 score is rendered with context:
//  - need band (LOW/MODERATE/HIGH/SEVERE NEED)
//  - derivation (LATEST contract value vs ALL YEARS client-side fallback)
//  - coverage (how many indicators/subdomains backed the number, which year)
//  - confidence (catches sparse latest-year inflation)
//
// Scores are higher = more favourable (lower development NEED), so a HIGH score
// maps to a LOW need band. No contract/pipeline changes here; coverage and
// fallbacks are computed from timeseries.json + meta.json.
// ─────────────────────────────────────────────────────────────────────────────

export type NeedKey = "low" | "moderate" | "high" | "severe";

export type NeedBand = {
  key: NeedKey;
  label: string;
  // Ink: text colour at AA on white. Fill: chips, dots, map swatches.
  // Both are design-system tokens, never hex (AC7.1).
  color: string;
  fill: string;
};

// Thresholds: 75 to 100 low, 50 to 74 moderate, 25 to 49 high, 0 to 24 severe.
const NEED_BANDS: ReadonlyArray<{ min: number; band: NeedBand }> = [
  { min: 75, band: { key: "low", label: "Low need", color: "var(--need-low-ink)", fill: "var(--need-low)" } },
  { min: 50, band: { key: "moderate", label: "Moderate need", color: "var(--need-moderate-ink)", fill: "var(--need-moderate)" } },
  { min: 25, band: { key: "high", label: "High need", color: "var(--need-high-ink)", fill: "var(--need-high)" } },
  { min: 0, band: { key: "severe", label: "Severe need", color: "var(--need-severe-ink)", fill: "var(--need-severe)" } },
];

// Human-readable need band for a score, or null when the score is missing.
export function needBand(score: number | null): NeedBand | null {
  if (score == null) return null;
  for (const { min, band } of NEED_BANDS) {
    if (score >= min) return band;
  }
  return NEED_BANDS[NEED_BANDS.length - 1].band;
}

// ── Derivation ───────────────────────────────────────────────────────────────

// How a displayed score was derived.
//  - "latest"    : published contract value (publish uses per-pillar latest non-null year)
//  - "all-years" : client-side fallback — latest non-null value per indicator, averaged
export type ScoreSource = "latest" | "all-years";

export function derivationLabel(source: ScoreSource): string {
  switch (source) {
    case "latest":
      return "Latest";
    case "all-years":
      return "All years";
  }
}

// ── Coverage + confidence ────────────────────────────────────────────────────

export type Coverage = {
  indicatorsWithData: number;
  indicatorsTotal: number;
  subdomainsWithData: number;
  subdomainsTotal: number;
  // The single year the score reflects (contract / latest), or null when the
  // value spans all years (client-side fallback).
  year: number | null;
};

export type Confidence = "high" | "partial" | "low";

// Confidence in a headline pillar score given its coverage.
//  - low     : ≤2 indicators (catches sparse latest-year inflation, e.g. health=100 from 2)
//  - high    : ≥70% indicators AND ≥50% subdomains
//  - partial : anything with data below the High bar
export function confidenceLevel(cov: Coverage): Confidence {
  if (cov.indicatorsWithData <= 2) return "low";
  const indPct = cov.indicatorsTotal > 0 ? cov.indicatorsWithData / cov.indicatorsTotal : 0;
  const sdPct = cov.subdomainsTotal > 0 ? cov.subdomainsWithData / cov.subdomainsTotal : 0;
  if (indPct >= 0.7 && sdPct >= 0.5) return "high";
  return "partial";
}

export function confidenceMeta(conf: Confidence): { label: string; color: string } {
  switch (conf) {
    case "high":
      return { label: "High", color: "var(--status-scored)" };
    case "partial":
      return { label: "Partial", color: "var(--status-incomplete)" };
    case "low":
      return { label: "Low", color: "var(--need-severe-ink)" };
  }
}

// Compact, human-readable coverage string, e.g. "4/11 indicators · 2024" or
// "3/11 indicators · all years".
export function coverageText(cov: Coverage): string {
  const when = cov.year != null ? String(cov.year) : "all years";
  return `${cov.indicatorsWithData}/${cov.indicatorsTotal} indicators · ${when}`;
}

// ── Pillar score context ─────────────────────────────────────────────────────

export type PillarScoreContext = {
  value: number | null;
  // null only when value is null.
  source: ScoreSource | null;
  coverage: Coverage | null;
  confidence: Confidence | null;
  band: NeedBand | null;
  // True when the value is a client-side fallback rather than a contract value.
  estimated: boolean;
};

function pillarIndicatorKeys(meta: MetaPayload, pillarKey: string): string[] {
  return meta.indicators.filter((i) => i.pillar === pillarKey).map((i) => i.key);
}

// Latest year index where ANY of the pillar's indicators reported a value.
function latestYearIdxWithData(
  country: CountryPayload,
  pillarKey: string,
  timeseries: TimeseriesPayload,
  meta: MetaPayload,
): number | null {
  const keys = pillarIndicatorKeys(meta, pillarKey);
  const ts = timeseries[country.iso3] ?? {};
  for (let yi = meta.years.length - 1; yi >= 0; yi--) {
    if (keys.some((k) => (ts[k]?.[yi] ?? null) != null)) return yi;
  }
  return null;
}

// Coverage at one specific year index (used for contract / latest scores).
function coverageAtYear(
  country: CountryPayload,
  pillarKey: string,
  timeseries: TimeseriesPayload,
  meta: MetaPayload,
  yearIdx: number,
): Coverage {
  const inds = meta.indicators.filter((i) => i.pillar === pillarKey);
  const ts = timeseries[country.iso3] ?? {};
  const indicatorsWithData = inds.filter((i) => (ts[i.key]?.[yearIdx] ?? null) != null).length;
  const sds = meta.subdomains.filter((s) => s.pillar === pillarKey);
  const subdomainsWithData = sds.filter((sd) =>
    inds.filter((i) => i.subdomain === sd.key).some((i) => (ts[i.key]?.[yearIdx] ?? null) != null),
  ).length;
  return {
    indicatorsWithData,
    indicatorsTotal: inds.length,
    subdomainsWithData,
    subdomainsTotal: sds.length,
    year: meta.years[yearIdx] ?? null,
  };
}

// Coverage across all years (latest non-null per indicator) — used for the
// client-side fallback value.
function coverageAllYears(
  country: CountryPayload,
  pillarKey: string,
  timeseries: TimeseriesPayload,
  meta: MetaPayload,
): Coverage {
  const inds = meta.indicators.filter((i) => i.pillar === pillarKey);
  const ts = timeseries[country.iso3] ?? {};
  const hasAny = (k: string) => latestValue(ts[k]) != null;
  const indicatorsWithData = inds.filter((i) => hasAny(i.key)).length;
  const sds = meta.subdomains.filter((s) => s.pillar === pillarKey);
  const subdomainsWithData = sds.filter((sd) =>
    inds.filter((i) => i.subdomain === sd.key).some((i) => hasAny(i.key)),
  ).length;
  return {
    indicatorsWithData,
    indicatorsTotal: inds.length,
    subdomainsWithData,
    subdomainsTotal: sds.length,
    year: null,
  };
}

// Client-side fallback pillar value: latest non-null per indicator, averaged.
// Mirrors computeFallbackPillarScores for a single pillar.
function fallbackPillarValue(
  country: CountryPayload,
  pillarKey: string,
  timeseries: TimeseriesPayload,
  meta: MetaPayload,
): number | null {
  const ts = timeseries[country.iso3] ?? {};
  const vals = pillarIndicatorKeys(meta, pillarKey)
    .map((k) => latestValue(ts[k]))
    .filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Full interpretive context for one pillar score. Prefers the published contract
// value (treated as LATEST); only when that is null does it fall back to the
// client-side ALL YEARS mean, flagged as estimated.
export function pillarScoreContext(
  country: CountryPayload,
  pillarKey: string,
  timeseries: TimeseriesPayload,
  meta: MetaPayload,
): PillarScoreContext {
  const direct = country.scores[pillarKey] ?? null;
  if (direct != null) {
    const yi = latestYearIdxWithData(country, pillarKey, timeseries, meta);
    const coverage = yi != null ? coverageAtYear(country, pillarKey, timeseries, meta, yi) : null;
    return {
      value: direct,
      source: "latest",
      coverage,
      confidence: coverage ? confidenceLevel(coverage) : null,
      band: needBand(direct),
      estimated: false,
    };
  }

  const fb = fallbackPillarValue(country, pillarKey, timeseries, meta);
  if (fb == null) {
    return { value: null, source: null, coverage: null, confidence: null, band: null, estimated: false };
  }
  const coverage = coverageAllYears(country, pillarKey, timeseries, meta);
  return {
    value: fb,
    source: "all-years",
    coverage,
    confidence: confidenceLevel(coverage),
    band: needBand(fb),
    estimated: true,
  };
}

// ── Overall score context ────────────────────────────────────────────────────

export type OverallScoreContext = {
  value: number | null;
  // "latest"  : published country.overall; null when any pillar is null
  source: Extract<ScoreSource, "latest"> | null;
  band: NeedBand | null;
  estimated: boolean;
};

export function overallContext(country: CountryPayload): OverallScoreContext {
  if (country.overall == null) return { value: null, source: null, band: null, estimated: false };
  return { value: country.overall, source: "latest", band: needBand(country.overall), estimated: false };
}

// ── Tooltip helper ───────────────────────────────────────────────────────────

// One-line-per-fact tooltip text for a pillar score (used where badges would be
// too dense, e.g. the Explore table cells).
export function pillarScoreTooltip(ctx: PillarScoreContext, pillarLabel: string): string {
  if (ctx.value == null) return `${pillarLabel}: no data in this snapshot`;
  const parts = [`${pillarLabel}: ${ctx.estimated ? "~" : ""}${ctx.value}`];
  if (ctx.band) parts.push(ctx.band.label);
  if (ctx.source) parts.push(derivationLabel(ctx.source));
  if (ctx.coverage) parts.push(coverageText(ctx.coverage));
  return parts.join(" · ");
}
