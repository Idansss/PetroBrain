import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { GhgempReport } from '@/lib/emissions/types';

import { ReportViewer } from './ReportViewer';

function reportWithGaps(): GhgempReport {
  return {
    report_type: 'GHGEMP Inventory Report',
    jurisdiction: 'Nigeria',
    operator: 'PetroBrain Energy',
    asset: 'OML-99',
    facility_id: 'FAC-1',
    reporting_period: '2026-Q3',
    prepared_by: 'PetroBrain',
    generated_utc: '2026-06-04T10:00:00Z',
    gwp_basis: 'IPCC AR6',
    summary: {
      total_co2e_tonnes: 1200,
      total_ch4_tonnes: 12,
      total_co2_tonnes: 1000,
      total_n2o_tonnes: 1,
    },
    tier_status: {
      target_tier: 'Tier 3',
      lines_by_tier: { 'Tier 2': 2 },
      tier_readiness_pct: 0,
      gaps_to_target: [
        {
          source_id: 'flare-1',
          source_type: 'flaring',
          current_tier: 'Tier 2',
        },
      ],
    },
    source_inventory: [],
    methodology_notes: ['Confirm factors before filing.'],
    compliance_flags: [],
    audit_sha256: 'abc123',
  };
}

describe('ReportViewer', () => {
  it('renders tier gaps as engineer-facing actions instead of raw objects', () => {
    render(<ReportViewer report={reportWithGaps()} />);

    const gaps = screen.getByText('Gaps to target tier').closest('section') ?? screen.getByText('Gaps to target tier').parentElement!;

    expect(within(gaps).getByText('Source flare-1')).toBeInTheDocument();
    expect(within(gaps).getByText('Flaring source')).toBeInTheDocument();
    expect(within(gaps).getByText('Tier 2 to Tier 3')).toBeInTheDocument();
    expect(within(gaps).getByText(/Add measurement-based activity data/)).toBeInTheDocument();
    expect(within(gaps).queryByText(/source_id/)).not.toBeInTheDocument();
    expect(within(gaps).queryByText(/source_type/)).not.toBeInTheDocument();
    expect(within(gaps).queryByText(/[{}]/)).not.toBeInTheDocument();
  });
});
