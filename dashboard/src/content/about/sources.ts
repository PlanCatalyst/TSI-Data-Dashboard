/**
 * The data sources. They open the About page as a grid of cells (requirements
 * REQ9.16) and feed the coverage bars in section 10.
 */

export type SourceId = "sdg" | "wdi" | "wgi" | "ids" | "undp" | "ndgain";

export type DataSource = {
  id: SourceId;
  name: string;
  provider: string;
  /** What the dashboard takes from it. */
  gets: string;
  /** Why this source. */
  why: string;
  /** Indicator keys it feeds. Coverage years are read live from these. */
  indicators: string[];
  url: string;
};

export const SOURCES: DataSource[] = [
  {
    id: "sdg",
    name: "UN SDG Indicators Database",
    provider: "United Nations Statistics Division",
    gets: "Official country statistics on health, nutrition, water, sanitation, energy, financial access, poverty and agriculture aid.",
    why: "It is the UN's own record of progress on the Sustainable Development Goals, so the numbers match what countries report.",
    indicators: ["uhc", "tb", "mal", "mmr", "u5mr", "stunt", "maln", "anaem", "contra", "abr", "ihr", "food", "susag", "agoda", "water", "sanit", "washmort", "elec", "clean", "renew", "finc", "pov"],
    url: "https://unstats.un.org/sdgs/indicators/database/",
  },
  {
    id: "wdi",
    name: "World Bank World Development Indicators",
    provider: "World Bank",
    gets: "Population density, and national income (GDP) for every country.",
    why: "Density tells us how crowded a country is. National income lets us turn aid dollars into a share of the economy, so countries of different sizes can be compared fairly.",
    indicators: ["popdens"],
    url: "https://datatopics.worldbank.org/world-development-indicators/",
  },
  {
    id: "wgi",
    name: "World Bank Worldwide Governance Indicators",
    provider: "World Bank",
    gets: "Government effectiveness: how well a state delivers services and carries out policy.",
    why: "Whether a government can deliver services shapes every other outcome, so we measure it in the country context pillar.",
    indicators: ["state"],
    url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
  },
  {
    id: "ids",
    name: "World Bank International Debt Statistics",
    provider: "World Bank",
    gets: "Debt stock and debt service ratios for countries that borrow from the World Bank.",
    why: "Debt limits what a government can spend on its people. It is one of the inputs to our macro-economic performance index.",
    indicators: ["mspi"],
    url: "https://www.worldbank.org/en/programs/debt-statistics/ids",
  },
  {
    id: "undp",
    name: "UNDP Human Development Reports",
    provider: "United Nations Development Programme",
    gets: "The Gender Inequality Index and the Multidimensional Poverty Index.",
    why: "They show inequality between women and men, and poverty beyond income, which the SDG statistics cover thinly.",
    indicators: ["gii", "mpi"],
    url: "https://hdr.undp.org/data-center",
  },
  {
    id: "ndgain",
    name: "ND-GAIN Country Index",
    provider: "University of Notre Dame",
    gets: "How vulnerable each country is to climate change, from 1995 to 2024.",
    why: "It gives every country one consistent score for how exposed it is to climate change, which no SDG statistic provides. It makes up our climate adaptation pillar.",
    indicators: ["ndgain"],
    url: "https://gain.nd.edu/our-work/country-index/",
  },
];

/** The source string meta.json carries for each indicator, mapped to our source id. */
export const META_SOURCE_TO_ID: Record<string, SourceId> = {
  "SDG Indicators Database": "sdg",
  "World Bank": "wdi",
  "World Bank Worldwide Governance Indicators (WGI)": "wgi",
  "World Bank WDI, WGI, and International Debt Statistics": "ids",
  "UNDP Human Development Reports": "undp",
  "University of Notre Dame": "ndgain",
};

export function sourceById(id: SourceId): DataSource | undefined {
  return SOURCES.find((s) => s.id === id);
}
