// Fixed pillar to chart-series colour mapping. One pillar is always the same
// colour on every chart for every country. Source: design system tokens
// --s-*. The contract's pillar.color is ignored on purpose: it is a pipeline
// default, not a brand decision.
const SERIES: Record<string, string> = {
  health: "var(--s-health)",
  ag: "var(--s-agri)",
  si: "var(--s-social)",
  women: "var(--s-gender)",
  climate: "var(--s-climate)",
  ctx: "var(--s-context)",
  pri: "var(--s-socio)",
};

export const OVERALL_SERIES_KEY = "overall";

export function seriesColor(pillarKey: string): string {
  if (pillarKey === OVERALL_SERIES_KEY) return "var(--s-overall)";
  return SERIES[pillarKey] ?? "var(--n-600)";
}

// Region palette for Explore and Trends. Fixed order, token-backed, one copy.
const REGIONS: Record<string, string> = {
  afe: "var(--s-health)",
  afw: "var(--pc-navy)",
  eap: "var(--s-agri)",
  eca: "var(--s-climate)",
  lcr: "var(--s-context)",
  mna: "var(--s-social)",
  sar: "var(--s-gender)",
  nam: "var(--s-socio)",
};

export function regionColor(code: string): string {
  return REGIONS[code] ?? "var(--pc-blue)";
}

// Compare page: up to five countries side by side.
export const COUNTRY_PALETTE = [
  "var(--s-health)",
  "var(--s-context)",
  "var(--s-climate)",
  "var(--s-gender)",
  "var(--need-severe)",
] as const;
