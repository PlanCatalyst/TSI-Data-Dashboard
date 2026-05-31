/**
 * Static copy and display configuration for the About page.
 * Edit text here — components import these values and render them.
 *
 * INTRO_PARAGRAPHS  — body text shown above the indicator framework
 * SOURCE_NOTE       — small-print footer below the framework grid
 * FRAMEWORK_CARDS   — how pillars are grouped into display cards (title, color, pillar keys)
 *                     Colors and groupings here are presentational; pillar keys must match
 *                     the `key` values in meta.json pillars.
 */

export const ABOUT_INTRO: string[] = [
  "This interactive data tool brings together publicly available development indicator data — spanning healthcare, agriculture, social infrastructure, and cross-cutting themes — for countries worldwide.",
  "It is designed both as a public resource and as a demonstration of our analytical approach. Users can explore country-level trends, compare sub-domains across all countries, and examine the data inputs that underpin our programme work.",
];

export const SOURCE_NOTE =
  "All data is publicly available. Index values are normalised to 0–100 for comparability; higher values indicate more favourable conditions unless otherwise noted. Scoring methodology is described in the technical documentation.";

export type FrameworkCardGroup = {
  title: string;
  color: string;
  pillars: string[];
};

/**
 * Controls the 5 cards in the indicator framework grid.
 * To reorder cards, change the order of entries.
 * To move a pillar to a different card, update its entry in `pillars`.
 */
export const FRAMEWORK_CARDS: FrameworkCardGroup[] = [
  {
    title: "Domain 1: Impact — Healthcare",
    color: "#0079c1",
    pillars: ["health"],
  },
  {
    title: "Domain 1: Impact — Agriculture & Social infrastructure",
    color: "#7a9a1f",
    pillars: ["ag", "si"],
  },
  {
    title: "Cross-cutting themes",
    color: "#7a6058",
    pillars: ["women", "climate"],
  },
  {
    title: "Domain 2: Country context",
    color: "#435d7f",
    pillars: ["ctx"],
  },
  {
    title: "Domain 3: Socio-economic performance",
    color: "#3a5a6a",
    pillars: ["pri"],
  },
];
