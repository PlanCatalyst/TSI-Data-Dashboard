import type { CountriesPayload, DashboardContract, MetaPayload, TimeseriesPayload } from "./types";

type ContractLoaderOptions = {
  baseUrl?: string;
};

const DEFAULT_BASE_URL = "/v1";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return (await response.json()) as T;
}

function assertContractShape(meta: MetaPayload, countries: CountriesPayload, timeseries: TimeseriesPayload) {
  if (!Array.isArray(meta.years) || meta.years.length === 0) {
    throw new Error("meta.years is missing or empty");
  }
  const countryIso3 = new Set(countries.map((country) => country.iso3));
  const timeseriesIso3 = new Set(Object.keys(timeseries));
  for (const iso3 of countryIso3) {
    if (!timeseriesIso3.has(iso3)) {
      throw new Error(`timeseries missing iso3: ${iso3}`);
    }
  }
}

export async function loadDashboardContract(options: ContractLoaderOptions = {}): Promise<DashboardContract> {
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_CONTRACT_BASE_URL ?? DEFAULT_BASE_URL;
  const [meta, countries, timeseries] = await Promise.all([
    fetchJson<MetaPayload>(`${baseUrl}/meta.json`),
    fetchJson<CountriesPayload>(`${baseUrl}/countries.json`),
    fetchJson<TimeseriesPayload>(`${baseUrl}/timeseries.json`)
  ]);

  assertContractShape(meta, countries, timeseries);
  return { meta, countries, timeseries };
}
