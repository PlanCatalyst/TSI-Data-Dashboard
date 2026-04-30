import type { CountriesPayload, CountryPayload, MetaPayload } from "./types";

export function getCountryByIso3(countries: CountriesPayload, iso3: string): CountryPayload | undefined {
  return countries.find((country) => country.iso3 === iso3);
}

export function getDefaultYear(meta: MetaPayload): number | null {
  return meta.years.length > 0 ? meta.years[meta.years.length - 1] : null;
}

export function sortCountriesByName(countries: CountriesPayload): CountriesPayload {
  return [...countries].sort((a, b) => a.name.localeCompare(b.name));
}
