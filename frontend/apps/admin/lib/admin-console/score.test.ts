import { describe, expect, it } from 'vitest';

import { missingAssetLevels, scoreTone, statusLine } from './score.js';
import type { DataReadiness } from './types.js';

function fixture(overrides: Partial<DataReadiness> = {}): DataReadiness {
  return {
    tenant_id: 'tenant-a',
    readiness_pct: 0,
    documents: { loaded: 0, indexed: 0, failed: 0, score_pct: 0 },
    assets: { total: 0, by_type: {}, score_pct: 0 },
    users: { active: 0, pending_invites: 0, score_pct: 0 },
    connectors: { status: 'not_wired', note: 'stub', score_pct: 0 },
    weights: { documents: 0.5, assets: 0.3, users: 0.1, connectors: 0.1 },
    ...overrides,
  };
}

describe('scoreTone', () => {
  it.each([
    [0, 'neutral'],
    [10, 'danger'],
    [49, 'danger'],
    [50, 'warn'],
    [79, 'warn'],
    [80, 'safe'],
    [95, 'safe'],
  ] as const)('%d → %s', (pct, expected) => {
    expect(scoreTone(pct)).toBe(expected);
  });
});

describe('statusLine', () => {
  it('explains the zero-score state', () => {
    expect(statusLine(fixture({ readiness_pct: 0 }))).toMatch(/No data yet/);
  });

  it('says "in progress" between 0 and 50', () => {
    expect(statusLine(fixture({ readiness_pct: 30 }))).toMatch(/Onboarding in progress/);
  });

  it('says "gaps remain" between 50 and 80', () => {
    expect(statusLine(fixture({ readiness_pct: 70 }))).toMatch(/gaps remain/);
  });

  it('says "ready for pilot" at or above 80', () => {
    expect(statusLine(fixture({ readiness_pct: 85 }))).toMatch(/Ready for pilot/);
  });
});

describe('missingAssetLevels', () => {
  it('returns every canonical level when the tenant has no assets', () => {
    expect(missingAssetLevels({})).toEqual(['field', 'block', 'train', 'equipment']);
  });

  it('returns only missing levels when some are present', () => {
    expect(missingAssetLevels({ field: 1, equipment: 2 })).toEqual(['block', 'train']);
  });

  it('treats explicit zero the same as missing', () => {
    expect(missingAssetLevels({ field: 0 })).toEqual(['field', 'block', 'train', 'equipment']);
  });
});
