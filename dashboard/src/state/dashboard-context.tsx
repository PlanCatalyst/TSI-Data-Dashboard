import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { loadDashboardContract } from "../data/contract/loaders";
import type { CountriesPayload, MetaPayload, TimeseriesPayload } from "../data/contract/types";

type DashboardContextValue = {
  meta: MetaPayload | null;
  countries: CountriesPayload;
  timeseries: TimeseriesPayload;
  reload: () => Promise<void>;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: PropsWithChildren) {
  const [meta, setMeta] = useState<MetaPayload | null>(null);
  const [countries, setCountries] = useState<CountriesPayload>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesPayload>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const contract = await loadDashboardContract();
      setMeta(contract.meta);
      setCountries(contract.countries);
      setTimeseries(contract.timeseries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown contract loading error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const value = useMemo<DashboardContextValue>(
    () => ({ meta, countries, timeseries, reload }),
    [meta, countries, timeseries]
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void reload()} />;
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardData() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboardData must be used within DashboardProvider");
  }
  return context;
}
