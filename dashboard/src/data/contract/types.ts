export type Region = {
  code: string;
  label: string;
};

export type Pillar = {
  key: string;
  label: string;
  color: string;
  repIndicator: string;
};

export type Indicator = {
  key: string;
  label: string;
  sdg: string;
  source: string;
  unit: string;
  pillar: string;
  subdomain: string;
  rawDirection: string;
  scoredDirection: string;
};

export type MetaPayload = {
  schemaVersion: string;
  generatedAt: string;
  pipelineRunId: string;
  scoringDirection: "higher_is_better";
  years: number[];
  regions: Region[];
  pillars: Pillar[];
  indicators: Indicator[];
  projections: {
    enabled: boolean;
    firstProjectedYear: number | null;
    note: string;
  };
};

export type CountryScores = Record<string, number | null>;

export type CountryPayload = {
  id: number;
  iso3: string;
  name: string;
  region: string;
  scores: CountryScores;
  overall: number | null;
  trend: Array<number | null>;
};

export type CountriesPayload = CountryPayload[];

export type TimeseriesPayload = Record<string, Record<string, Array<number | null>>>;

export type DashboardContract = {
  meta: MetaPayload;
  countries: CountriesPayload;
  timeseries: TimeseriesPayload;
};
