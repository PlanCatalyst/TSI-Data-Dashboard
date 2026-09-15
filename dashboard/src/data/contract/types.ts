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

export type Subdomain = {
  key: string;
  label: string;
  pillar: string;
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
  projections: {
    enabled: boolean;
    firstProjectedYear: number | null;
    note: string;
  };
  regions: Region[];
  pillars: Pillar[];
  subdomains: Subdomain[];
  indicators: Indicator[];
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

/** docs/data-contract.md §8 — join only on iso3 × indicator_code × year. */
export type ProjectionStatus = "forecast" | "unavailable";

export type ProjectionRow = {
  iso3: string;
  indicator_code: string;
  year: number;
  value?: number | null;
  value_lo: number | null;
  value_hi: number | null;
  /** Either key is accepted; if both are set they must agree (publisher-validated). */
  status?: ProjectionStatus;
  record_type?: ProjectionStatus;
  unavailable_reason?: string | null;
};

export type ProjectionsPayload = ProjectionRow[];

export type DashboardContract = {
  meta: MetaPayload;
  countries: CountriesPayload;
  timeseries: TimeseriesPayload;
  /** Present when meta.projections.enabled; otherwise empty (historical-only path). */
  projections: ProjectionsPayload;
};
