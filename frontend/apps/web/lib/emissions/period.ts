/**
 * Period parsing for the MRV history filter.
 *
 * The backend ``period`` field is a freeform string but the engine and
 * the operator both treat ``YYYY-Q[1-4]`` (eg. "2026-Q3") as canonical.
 * We extract year + quarter so the filter UI can offer dropdowns; rows
 * whose period doesn't match the pattern are returned as ``null`` so the
 * caller can decide to keep or drop them.
 */
export interface ParsedPeriod {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

export function parsePeriod(period: string): ParsedPeriod | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(period.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    quarter: Number(match[2]) as 1 | 2 | 3 | 4,
  };
}

export function formatPeriod({ year, quarter }: ParsedPeriod): string {
  return `${year}-Q${quarter}`;
}
