import { describe, it, expect } from "vitest";
import { formatScore, formatTimestamp } from "./formatters";

describe("formatScore", () => {
  it("returns 'No data' for null", () => {
    expect(formatScore(null)).toBe("No data");
  });

  it("formats zero with one decimal place", () => {
    expect(formatScore(0)).toBe("0.0");
  });

  it("formats an integer with one decimal place", () => {
    expect(formatScore(8)).toBe("8.0");
  });

  it("formats 100 with one decimal place", () => {
    expect(formatScore(100)).toBe("100.0");
  });

  it("rounds to one decimal place", () => {
    expect(formatScore(8.567)).toBe("8.6");
  });

  it("preserves an exact decimal", () => {
    expect(formatScore(42.5)).toBe("42.5");
  });
});

describe("formatTimestamp", () => {
  it("returns 'Not available' for null", () => {
    expect(formatTimestamp(null)).toBe("Not available");
  });

  it("returns 'Not available' for undefined", () => {
    expect(formatTimestamp(undefined)).toBe("Not available");
  });

  it("returns 'Not available' for empty string", () => {
    expect(formatTimestamp("")).toBe("Not available");
  });

  it("returns the raw string for an unparseable value", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });

  it("returns a formatted date string for a valid ISO timestamp", () => {
    const result = formatTimestamp("2024-01-15T10:30:00Z");
    expect(result).not.toBe("2024-01-15T10:30:00Z");
    expect(result).not.toBe("Not available");
    expect(new Date("2024-01-15T10:30:00Z").getTime()).not.toBeNaN();
  });
});
