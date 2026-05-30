import { describe, expect, it } from 'vitest';

import { formatHeadline, formatInputChips } from './format.js';
import type { CalcResultDto } from './types.js';

const RESULT: CalcResultDto = {
  name: 'Hydrostatic Pressure',
  formula: 'HP = 0.052 * MW * TVD',
  inputs: { mw_ppg: 9.6, tvd_ft: 10000 },
  result: 4992,
  unit: 'psi',
  steps: ['HP = 0.052 * 9.6 * 10000 = 4992.0 psi'],
  notes: [],
  safety_critical: false,
};

describe('formatHeadline', () => {
  it('shows result + unit with at most 4 fraction digits', () => {
    expect(formatHeadline(RESULT)).toMatch(/4,?992 psi/);
  });

  it('does not round long decimals beyond 4 digits', () => {
    const noisy: CalcResultDto = { ...RESULT, result: 4992.1234567 };
    expect(formatHeadline(noisy)).toMatch(/4,?992\.1235 psi/);
  });
});

describe('formatInputChips', () => {
  it('returns one chip per input with the submitted unit attached', () => {
    const chips = formatInputChips(RESULT, { mw_ppg: 'sg', tvd_ft: 'ft' });
    expect(chips).toEqual([
      { name: 'mw_ppg', value: 9.6, unit: 'sg' },
      { name: 'tvd_ft', value: 10000, unit: 'ft' },
    ]);
  });

  it('omits the unit field when nothing was submitted for that input', () => {
    const chips = formatInputChips(RESULT, undefined);
    expect(chips).toEqual([
      { name: 'mw_ppg', value: 9.6 },
      { name: 'tvd_ft', value: 10000 },
    ]);
  });
});
