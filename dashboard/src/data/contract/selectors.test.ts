import { describe, it, expect } from "vitest";
import { getCountryByIso3, getDefaultYear, sortCountriesByName } from "./selectors";
import type { CountriesPayload, MetaPayload } from "./types";

const makeCountry = (iso3: string, name: string) => ({
  id: 0, iso3, name, region: "SSA", scores: {}, overall: null, trend: [],
});

const COUNTRIES: CountriesPayload = [
  makeCountry("NGA", "Nigeria"),
  makeCountry("KEN", "Kenya"),
  makeCountry("ETH", "Ethiopia"),
];

describe("getCountryByIso3", () => {
  it("returns the matching country", () => {
    expect(getCountryByIso3(COUNTRIES, "KEN")).toEqual(makeCountry("KEN", "Kenya"));
  });

  it("returns undefined when iso3 is not in the list", () => {
    expect(getCountryByIso3(COUNTRIES, "ZZZ")).toBeUndefined();
  });

  it("returns undefined on an empty array", () => {
    expect(getCountryByIso3([], "KEN")).toBeUndefined();
  });
});

describe("getDefaultYear", () => {
  it("returns the last year in meta.years", () => {
    const meta = { years: [2018, 2019, 2020, 2021] } as unknown as MetaPayload;
    expect(getDefaultYear(meta)).toBe(2021);
  });

  it("returns null when meta.years is empty", () => {
    const meta = { years: [] } as unknown as MetaPayload;
    expect(getDefaultYear(meta)).toBeNull();
  });

  it("returns the only year when there is one entry", () => {
    const meta = { years: [2023] } as unknown as MetaPayload;
    expect(getDefaultYear(meta)).toBe(2023);
  });
});

describe("sortCountriesByName", () => {
  it("returns countries in alphabetical order", () => {
    const sorted = sortCountriesByName(COUNTRIES);
    expect(sorted.map(c => c.name)).toEqual(["Ethiopia", "Kenya", "Nigeria"]);
  });

  it("does not mutate the original array", () => {
    const original = [...COUNTRIES];
    sortCountriesByName(COUNTRIES);
    expect(COUNTRIES).toEqual(original);
  });

  it("handles an already-sorted array", () => {
    const sorted = [makeCountry("ETH", "Ethiopia"), makeCountry("KEN", "Kenya")];
    expect(sortCountriesByName(sorted).map(c => c.name)).toEqual(["Ethiopia", "Kenya"]);
  });

  it("returns an empty array when given an empty array", () => {
    expect(sortCountriesByName([])).toEqual([]);
  });
});