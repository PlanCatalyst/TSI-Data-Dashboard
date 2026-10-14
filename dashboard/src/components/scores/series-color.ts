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
