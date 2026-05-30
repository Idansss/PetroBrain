/**
 * Display formatters for calc results.
 *
 * Pure functions so the UI never invents numbers and the tests can
 * pin the on-screen text against a known result.
 */
import type { CalcResultDto } from './types.js';

export function formatHeadline(result: CalcResultDto): string {
  const value = result.result.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return `${value} ${result.unit}`;
}

export interface InputDisplay {
  name: string;
  value: number;
  unit?: string | undefined;
}

export function formatInputChips(
  result: CalcResultDto,
  submittedUnits: Record<string, string> | undefined,
): InputDisplay[] {
  return Object.entries(result.inputs).map(([name, value]) => {
    const inputDisplay: InputDisplay = { name, value };
    if (submittedUnits && submittedUnits[name]) {
      inputDisplay.unit = submittedUnits[name];
    }
    return inputDisplay;
  });
}
