import { describe, expect, it } from 'vitest';

import { formatPeriod, parsePeriod } from './period.js';

describe('parsePeriod', () => {
  it.each([
    ['2026-Q1', { year: 2026, quarter: 1 }],
    ['2026-Q3', { year: 2026, quarter: 3 }],
    ['2024-Q4', { year: 2024, quarter: 4 }],
  ] as const)('parses %s', (input, expected) => {
    expect(parsePeriod(input)).toEqual(expected);
  });

  it.each(['2026', '26-Q3', '2026-Q5', '2026-Q0', '2026Q3', 'Q3-2026', 'random'])(
    'returns null for malformed %s',
    (input) => {
      expect(parsePeriod(input)).toBeNull();
    },
  );

  it('round-trips through formatPeriod', () => {
    const p = parsePeriod('2026-Q3')!;
    expect(formatPeriod(p)).toBe('2026-Q3');
  });
});
