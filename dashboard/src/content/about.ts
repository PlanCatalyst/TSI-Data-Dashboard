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

/** Methodology section — placeholder copy; final wording swaps in when client approves. */
export const METHODOLOGY_SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: "What the scores mean",
    paragraphs: [
      "Every indicator is normalised to a 0–100 scale where higher values indicate more favourable development conditions (lower need). Pillar and subdomain scores are simple arithmetic means of their constituent indicators for the selected year.",
      "Missing observations are never coerced to zero. A dash (—) means the value is null in the published data contract — either the source has no observation for that country-year, or the indicator is intentionally deferred.",
    ],
  },
  {
    title: "How indicators are selected",
    paragraphs: [
      "The framework draws on 28 indicators organised across seven pillars and 17 subdomains. Most indicators map directly to UN Sustainable Development Goal (SDG) official statistics; supplementary sources fill gaps where SDG coverage is thin (gender inequality, climate vulnerability, governance, poverty depth).",
      "Indicator definitions, units, and scoring direction are documented in the repository taxonomy (`indicators/indicators.yaml`) and audited in `indicators/SCORING_AUDIT.md`.",
    ],
  },
  {
    title: "Aggregation & orientation",
    paragraphs: [
      "The pipeline scores each indicator in a vulnerability orientation (higher = greater need), then inverts at the publish boundary so the frontend consumes a single contract: higher is better. This keeps scorer logic stable while matching the dashboard colour scale.",
      "Population density uses a banded formula (not a continuous min-max scale). Its semantic direction (whether it contributes to the context pillar score or is display-only) is pending client confirmation.",
    ],
  },
];

/** Data source attributions — names are stable; URLs and licence wording finalize later. */
export const SOURCE_ATTRIBUTIONS: { name: string; description: string; indicators: string }[] = [
  {
    name: "UN SDG Indicators Database",
    description:
      "Official SDG statistics via the UN Statistics Division API. Primary source for health, agriculture, WASH, energy access, and poverty indicators.",
    indicators: "Most SDG-mapped indicators (e.g. UHC, food security, water, electricity, clean fuels)",
  },
  {
    name: "World Bank Open Data",
    description:
      "World Development Indicators API. Population density and GDP series used for context indicators and normalisation.",
    indicators: "Population density (popdens); GDP for agriculture-flow normalisation",
  },
  {
    name: "ND-GAIN Country Index",
    description:
      "Notre Dame Global Adaptation Initiative composite vulnerability scores (1995–2023).",
    indicators: "Climate vulnerability (ndgain)",
  },
  {
    name: "UNDP Human Development Reports",
    description:
      "HDR composite indices and Global MPI tables. Gender inequality, human development, and multidimensional poverty.",
    indicators: "Gender Inequality Index (gii), Human Development Index (hdi), MPI (mpi)",
  },
  {
    name: "World Bank Worldwide Governance Indicators",
    description:
      "Government Effectiveness dimension, pre-normalised 0–100 favourability scale (1996–2024).",
    indicators: "State capacity proxy (state)",
  },
];

export const SOURCE_NOTE =
  "All data is publicly available. Index values are normalised to 0–100 for comparability; higher values indicate more favourable conditions. Missing values are shown as blank (—), never as zero. Scoring methodology is described in the technical documentation.";

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
