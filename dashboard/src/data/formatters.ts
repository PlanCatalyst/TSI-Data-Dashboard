export function formatScore(value: number | null): string {
  return value === null ? "No data" : value.toFixed(1);
}

export function formatTimestamp(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) {
    return "Not available";
  }
  const date = new Date(isoTimestamp);
  return Number.isNaN(date.getTime()) ? isoTimestamp : date.toLocaleString();
}
