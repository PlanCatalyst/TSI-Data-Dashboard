import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook } from "@testing-library/react";
import { DashboardProvider, useDashboardData } from "./dashboard-context";
import { loadDashboardContract } from "../data/contract/loaders";

vi.mock("../data/contract/loaders");

const VALID_CONTRACT = {
  meta: {
    schemaVersion: "1.0",
    generatedAt: "2024-01-01T00:00:00Z",
    pipelineRunId: "test",
    scoringDirection: "higher_is_better" as const,
    years: [2020, 2021],
    projections: { enabled: false, firstProjectedYear: null, note: "" },
    regions: [],
    pillars: [],
    subdomains: [],
    indicators: [],
  },
  countries: [
    { id: 1, iso3: "KEN", name: "Kenya", region: "SSA", scores: {}, overall: null, trend: [] },
  ],
  timeseries: { KEN: {} },
};

beforeEach(() => {
  vi.mocked(loadDashboardContract).mockReset();
});

// --- DashboardProvider loading state ---

describe("DashboardProvider — loading state", () => {
  it("shows loading indicator before contract resolves", () => {
    vi.mocked(loadDashboardContract).mockReturnValue(new Promise(() => {})); // never resolves
    render(<DashboardProvider><div>content</div></DashboardProvider>);
    expect(screen.getByText("Loading dashboard data...")).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });
});

// --- DashboardProvider success state ---

describe("DashboardProvider — success state", () => {
  it("renders children after contract loads", async () => {
    vi.mocked(loadDashboardContract).mockResolvedValue(VALID_CONTRACT);
    render(<DashboardProvider><div>content</div></DashboardProvider>);
    await waitFor(() => expect(screen.getByText("content")).toBeInTheDocument());
  });

  it("no longer shows loading indicator after contract loads", async () => {
    vi.mocked(loadDashboardContract).mockResolvedValue(VALID_CONTRACT);
    render(<DashboardProvider><div>content</div></DashboardProvider>);
    await waitFor(() => expect(screen.queryByText("Loading dashboard data...")).not.toBeInTheDocument());
  });
});

// --- DashboardProvider error state ---

describe("DashboardProvider — error state", () => {
  it("shows error message when contract fetch fails", async () => {
    vi.mocked(loadDashboardContract).mockRejectedValue(new Error("Failed to fetch /v1/meta.json (500)"));
    render(<DashboardProvider><div>content</div></DashboardProvider>);
    await waitFor(() =>
      expect(screen.getByText("Failed to fetch /v1/meta.json (500)")).toBeInTheDocument()
    );
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("shows the retry button on error", async () => {
    vi.mocked(loadDashboardContract).mockRejectedValue(new Error("network error"));
    render(<DashboardProvider><div>content</div></DashboardProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument());
  });

  it("retrying re-calls loadDashboardContract and shows children on success", async () => {
    vi.mocked(loadDashboardContract)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(VALID_CONTRACT);

    render(<DashboardProvider><div>content</div></DashboardProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("content")).toBeInTheDocument());
    expect(vi.mocked(loadDashboardContract)).toHaveBeenCalledTimes(2);
  });
});

// --- useDashboardData hook ---

describe("useDashboardData", () => {
  it("throws when used outside DashboardProvider", () => {
    expect(() => renderHook(() => useDashboardData())).toThrow(
      "useDashboardData must be used within DashboardProvider"
    );
  });

  it("returns meta, countries, timeseries, and reload after load", async () => {
    vi.mocked(loadDashboardContract).mockResolvedValue(VALID_CONTRACT);

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: ({ children }) => <DashboardProvider>{children}</DashboardProvider>,
    });

    await waitFor(() => expect(result.current.meta).not.toBeNull());

    expect(result.current.meta?.years).toEqual([2020, 2021]);
    expect(result.current.countries).toHaveLength(1);
    expect(result.current.timeseries).toEqual({ KEN: {} });
    expect(typeof result.current.reload).toBe("function");
  });
});
