import { describe, it, expect, vi, afterEach } from "vitest";
import { loadDashboardContract } from "./loaders";

// --- Fixtures ---

const VALID_META = {
  schemaVersion: "1.0",
  generatedAt: "2024-01-01T00:00:00Z",
  pipelineRunId: "test-run",
  scoringDirection: "higher_is_better" as const,
  years: [2020, 2021],
  projections: { enabled: false, firstProjectedYear: null, note: "" },
  regions: [],
  pillars: [],
  subdomains: [],
  indicators: [],
};

const VALID_COUNTRIES = [
  { id: 1, iso3: "KEN", name: "Kenya", region: "SSA", scores: {}, overall: null, trend: [] },
];

const VALID_TIMESERIES = { KEN: {} };

// --- Helpers ---

function jsonResponse(data: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(data) };
}

// Builds a fetch mock that dispatches by method and URL suffix.
// The probe (HEAD) resolves based on probeOk; data GETs use metaOverride for meta.json.
function stubFetch({
  probeOk = true,
  probeThrows = false,
  metaOverride,
  dataFails = false,
}: {
  probeOk?: boolean;
  probeThrows?: boolean;
  metaOverride?: object;
  dataFails?: boolean;
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        if (probeThrows) return Promise.reject(new Error("network error"));
        return Promise.resolve({ ok: probeOk });
      }
      if (dataFails) return Promise.resolve(jsonResponse({}, false, 500));
      const meta = metaOverride ? { ...VALID_META, ...metaOverride } : VALID_META;
      if (url.endsWith("/meta.json")) return Promise.resolve(jsonResponse(meta));
      if (url.endsWith("/countries.json")) return Promise.resolve(jsonResponse(VALID_COUNTRIES));
      if (url.endsWith("/timeseries.json")) return Promise.resolve(jsonResponse(VALID_TIMESERIES));
      return Promise.resolve(jsonResponse({}, false, 404));
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// --- URL resolution ---

describe("URL resolution", () => {
  it("uses /v1 when VITE_CONTRACT_BASE_URL is not set", async () => {
    stubFetch();
    await loadDashboardContract();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/v1/meta.json");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/v1/countries.json");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/v1/timeseries.json");
  });

  it("uses options.baseUrl directly without probing", async () => {
    stubFetch();
    await loadDashboardContract({ baseUrl: "https://custom.example.com/v1" });
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining("meta.json"),
      expect.objectContaining({ method: "HEAD" })
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("https://custom.example.com/v1/meta.json");
  });

  it("uses env URL when probe succeeds", async () => {
    vi.stubEnv("VITE_CONTRACT_BASE_URL", "https://azure.example.com/v1");
    stubFetch({ probeOk: true });
    await loadDashboardContract();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("https://azure.example.com/v1/meta.json");
  });

  it("falls back to /v1 when probe returns not-ok", async () => {
    vi.stubEnv("VITE_CONTRACT_BASE_URL", "https://azure.example.com/v1");
    stubFetch({ probeOk: false });
    await loadDashboardContract();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/v1/meta.json");
  });

  it("falls back to /v1 when probe throws a network error", async () => {
    vi.stubEnv("VITE_CONTRACT_BASE_URL", "https://azure.example.com/v1");
    stubFetch({ probeThrows: true });
    await loadDashboardContract();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/v1/meta.json");
  });
});

// --- assertContractShape validation ---

describe("contract shape validation", () => {
  it("resolves successfully for a valid schema version 1.x", async () => {
    stubFetch({ metaOverride: { schemaVersion: "1.9" } });
    await expect(loadDashboardContract()).resolves.toBeDefined();
  });

  it("throws for schema version 2.0", async () => {
    stubFetch({ metaOverride: { schemaVersion: "2.0" } });
    await expect(loadDashboardContract()).rejects.toThrow("Unsupported schema version: 2.0");
  });

  it("throws when meta.years is empty", async () => {
    stubFetch({ metaOverride: { years: [] } });
    await expect(loadDashboardContract()).rejects.toThrow("meta.years is missing or empty");
  });

  it("throws when a country iso3 is missing from timeseries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/meta.json")) return Promise.resolve(jsonResponse(VALID_META));
        if (url.endsWith("/countries.json"))
          return Promise.resolve(jsonResponse([
            ...VALID_COUNTRIES,
            { id: 2, iso3: "NGA", name: "Nigeria", region: "SSA", scores: {}, overall: null, trend: [] },
          ]));
        if (url.endsWith("/timeseries.json")) return Promise.resolve(jsonResponse(VALID_TIMESERIES));
        return Promise.resolve(jsonResponse({}, false, 404));
      })
    );
    await expect(loadDashboardContract()).rejects.toThrow("timeseries missing iso3: NGA");
  });
});

// --- Fetch error handling ---

describe("fetch error handling", () => {
  it("throws with URL and status when a data fetch returns non-ok", async () => {
    stubFetch({ dataFails: true });
    await expect(loadDashboardContract()).rejects.toThrow(/Failed to fetch.*500/);
  });
});
