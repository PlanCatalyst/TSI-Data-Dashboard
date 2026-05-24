import type { CountriesPayload, DashboardContract, MetaPayload, TimeseriesPayload } from "./types";

type ContractLoaderOptions = {
  baseUrl?: string;
};

const DEFAULT_BASE_URL = "/v1";

// Sends a HEAD request to <url>/meta.json to confirm the endpoint is reachable
// before committing all three parallel fetches to that base URL.
async function probeBaseUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/meta.json`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return (await response.json()) as T;
}

function assertContractShape(meta: MetaPayload, countries: CountriesPayload, timeseries: TimeseriesPayload) {
  const [major] = meta.schemaVersion.split(".");
  if (major !== "1") {
    throw new Error(`Unsupported schema version: ${meta.schemaVersion}`);
  }
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
  let baseUrl: string;
  if (options.baseUrl) {
    baseUrl = options.baseUrl;
    console.log(`[dashboard] Loading contract from explicit baseUrl: ${baseUrl}`);
  } else {
    const envUrl = import.meta.env.VITE_CONTRACT_BASE_URL as string | undefined;
    if (envUrl && await probeBaseUrl(envUrl)) {
      baseUrl = envUrl;
      console.log(`[dashboard] Loading contract from Azure: ${baseUrl}`);
    } else {
      if (envUrl) {
        console.warn(`[dashboard] Azure endpoint unreachable (${envUrl}), falling back to local /v1`);
      } else {
        console.log(`[dashboard] No VITE_CONTRACT_BASE_URL set, loading contract from local /v1`);
      }
      baseUrl = DEFAULT_BASE_URL;
    }
  }
  const [meta, countries, timeseries] = await Promise.all([
    fetchJson<MetaPayload>(`${baseUrl}/meta.json`),
    fetchJson<CountriesPayload>(`${baseUrl}/countries.json`),
    fetchJson<TimeseriesPayload>(`${baseUrl}/timeseries.json`)
  ]);

  assertContractShape(meta, countries, timeseries);
  return { meta, countries, timeseries };
}
