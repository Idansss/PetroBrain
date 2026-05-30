import { describe, expect, it } from 'vitest';

import type { InventoryHistoryRow } from '@/lib/emissions/types';

import { applyHistoryFilters, type HistoryFilterState } from './HistoryFilters';

function row(overrides: Partial<InventoryHistoryRow>): InventoryHistoryRow {
  return {
    inventory_id: overrides.inventory_id ?? 'inv-1',
    facility_id: overrides.facility_id ?? 'FAC-1',
    period: overrides.period ?? '2026-Q3',
    operator: overrides.operator ?? 'Demo E&P',
    asset: overrides.asset ?? 'OML-1',
    status: overrides.status ?? 'ready_for_target_tier',
    tier_readiness_pct: overrides.tier_readiness_pct ?? 100,
    gap_count: overrides.gap_count ?? 0,
    total_co2e_tonnes: overrides.total_co2e_tonnes ?? 0,
    audit_sha256: overrides.audit_sha256 ?? '',
    created_utc: overrides.created_utc ?? '',
  };
}

const ROWS: InventoryHistoryRow[] = [
  row({ inventory_id: 'a', facility_id: 'FAC-1', period: '2026-Q1' }),
  row({ inventory_id: 'b', facility_id: 'FAC-1', period: '2026-Q3' }),
  row({ inventory_id: 'c', facility_id: 'FAC-2', period: '2025-Q4' }),
  row({ inventory_id: 'd', facility_id: 'FAC-3', period: 'legacy-2024-Q2' }), // unparseable
];

const ALL: HistoryFilterState = { facility: '', year: 'all', quarter: 'all' };

describe('applyHistoryFilters', () => {
  it('returns everything when all filters are "all"', () => {
    expect(applyHistoryFilters(ROWS, ALL).map((r) => r.inventory_id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('filters by facility substring (case-insensitive)', () => {
    expect(
      applyHistoryFilters(ROWS, { ...ALL, facility: 'fac-1' }).map((r) => r.inventory_id),
    ).toEqual(['a', 'b']);
  });

  it('drops rows whose period does not parse once a year filter is set', () => {
    const out = applyHistoryFilters(ROWS, { ...ALL, year: 2026 });
    expect(out.map((r) => r.inventory_id)).toEqual(['a', 'b']);
  });

  it('combines year and quarter filters', () => {
    const out = applyHistoryFilters(ROWS, { facility: '', year: 2025, quarter: 4 });
    expect(out.map((r) => r.inventory_id)).toEqual(['c']);
  });

  it('combines facility and quarter filters', () => {
    const out = applyHistoryFilters(ROWS, { facility: 'fac-1', year: 'all', quarter: 1 });
    expect(out.map((r) => r.inventory_id)).toEqual(['a']);
  });
});
