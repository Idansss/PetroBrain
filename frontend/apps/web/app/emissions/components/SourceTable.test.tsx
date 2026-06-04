import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { InventoryLine } from '@/lib/emissions/types';

import { SourceTable, tierBadgeTone } from './SourceTable';

const LINES: InventoryLine[] = [
  {
    source_id: 'FL-1',
    source_type: 'flaring',
    tier: 'Tier 3',
    method: 'Carbon-balance flaring',
    ch4_tonnes: 0.3835,
    co2_tonnes: 51.5517,
    n2o_tonnes: 0,
    activity: {},
  },
  {
    source_id: 'FUG-2',
    source_type: 'fugitive_t2',
    tier: 'Tier 2',
    method: 'Component-count × EF',
    ch4_tonnes: 0.84,
    co2_tonnes: 0,
    n2o_tonnes: 0,
    activity: {},
  },
];

describe('SourceTable', () => {
  it('renders a row per source with the engine numbers', () => {
    render(<SourceTable lines={LINES} />);
    expect(screen.getByText('FL-1')).toBeInTheDocument();
    expect(screen.getByText('FUG-2')).toBeInTheDocument();
    const t3 = screen.getByTestId('source-FL-1');
    expect(within(t3).getByText('Flaring')).toBeInTheDocument();
    expect(screen.getByText('Fugitive emissions')).toBeInTheDocument();
    expect(screen.queryByText('fugitive_t2')).not.toBeInTheDocument();
    expect(within(t3).getByText('0.3835')).toBeInTheDocument();
    expect(within(t3).getByText('51.5517')).toBeInTheDocument();
  });

  it('tints Tier 3 rows safe and Tier 2 rows warn', () => {
    render(<SourceTable lines={LINES} />);
    const t3 = screen.getByTestId('source-FL-1');
    const t2 = screen.getByTestId('source-FUG-2');
    expect(t3.className).toContain('bg-safe-bg');
    expect(t2.className).toContain('bg-warn-bg');
  });

  it('renders the empty-state copy when there are no sources', () => {
    render(<SourceTable lines={[]} />);
    expect(screen.getByText(/No sources in this inventory/)).toBeInTheDocument();
  });
});

describe('tierBadgeTone', () => {
  it.each([
    ['Tier 3', 'safe'],
    ['Tier 2', 'warn'],
    ['Tier 1', 'danger'],
    ['Tier ?', 'neutral'],
  ] as const)('maps %s to %s', (tier, expected) => {
    expect(tierBadgeTone(tier)).toBe(expected);
  });
});
