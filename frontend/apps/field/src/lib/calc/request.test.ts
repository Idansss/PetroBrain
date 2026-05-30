import { describe, expect, it } from 'vitest';

import {
  buildCalcRequest,
  emptyFormState,
  familyLabel,
  groupByFamily,
  sortedFamilies,
} from './request.js';
import type { CalcCatalogEntry } from './types.js';

const HYDROSTATIC: CalcCatalogEntry = {
  name: 'hydrostatic',
  family: 'drilling',
  label: 'Hydrostatic pressure',
  summary: 'HP = 0.052 × MW × TVD.',
  safety_critical: false,
  notes: [],
  inputs: [
    { name: 'mw_ppg', label: 'Mud weight', canonical_unit: 'ppg', accepted_units: ['ppg', 'sg'], placeholder: 9.6 },
    { name: 'tvd_ft', label: 'TVD', canonical_unit: 'ft', accepted_units: ['ft', 'm'], placeholder: 10000 },
  ],
};

const PSI_TO_BAR: CalcCatalogEntry = {
  name: 'psi_to_bar',
  family: 'conversions',
  label: 'Pressure: psi → bar',
  summary: 'bar = psi / 14.5037744.',
  safety_critical: false,
  notes: [],
  inputs: [{ name: 'value_psi', label: 'psi', canonical_unit: 'psi', accepted_units: ['psi'], placeholder: 1000 }],
};

describe('emptyFormState', () => {
  it('seeds canonical units and stringified placeholders', () => {
    const state = emptyFormState(HYDROSTATIC);
    expect(state).toEqual({
      mw_ppg: { value: '9.6', unit: 'ppg' },
      tvd_ft: { value: '10000', unit: 'ft' },
    });
  });

  it('leaves value empty when the catalog has no placeholder', () => {
    const spec: CalcCatalogEntry = {
      ...HYDROSTATIC,
      inputs: [
        { name: 'mw_ppg', label: 'Mud weight', canonical_unit: 'ppg', accepted_units: ['ppg'], placeholder: null },
      ],
    };
    expect(emptyFormState(spec)).toEqual({ mw_ppg: { value: '', unit: 'ppg' } });
  });
});

describe('buildCalcRequest', () => {
  it('serialises a happy-path form', () => {
    const out = buildCalcRequest(HYDROSTATIC, {
      mw_ppg: { value: '9.6', unit: 'ppg' },
      tvd_ft: { value: '10000', unit: 'ft' },
    });
    expect(out).toEqual({
      ok: true,
      body: { name: 'hydrostatic', inputs: { mw_ppg: 9.6, tvd_ft: 10000 }, units: { mw_ppg: 'ppg', tvd_ft: 'ft' } },
    });
  });

  it('preserves non-canonical units the user picked', () => {
    const out = buildCalcRequest(HYDROSTATIC, {
      mw_ppg: { value: '1.15', unit: 'sg' },
      tvd_ft: { value: '3048', unit: 'm' },
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.body.units).toEqual({ mw_ppg: 'sg', tvd_ft: 'm' });
    }
  });

  it('flags empty + non-numeric + bad-unit fields with field-keyed errors', () => {
    const out = buildCalcRequest(HYDROSTATIC, {
      mw_ppg: { value: '', unit: 'ppg' },
      tvd_ft: { value: 'tall', unit: 'parsec' },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.errors).toEqual({
        mw_ppg: 'Required.',
        tvd_ft: 'Must be a number.',
      });
    }
  });

  it('flags only the unit when the value is numeric but the unit is unsupported', () => {
    const out = buildCalcRequest(HYDROSTATIC, {
      mw_ppg: { value: '9.6', unit: 'kg/m3' },
      tvd_ft: { value: '10000', unit: 'ft' },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.errors).toEqual({ mw_ppg: 'Pick one of ppg / sg.' });
    }
  });
});

describe('groupByFamily + sortedFamilies', () => {
  const entries: CalcCatalogEntry[] = [
    HYDROSTATIC,
    PSI_TO_BAR,
    { ...HYDROSTATIC, name: 'maasp', label: 'MAASP' },
    {
      ...PSI_TO_BAR,
      name: 'arps_exponential',
      family: 'production',
      label: 'Arps exponential decline',
    },
  ];

  it('groups by family, sorting each family alphabetically by label', () => {
    const grouped = groupByFamily(entries);
    expect(grouped.drilling?.map((e) => e.name)).toEqual(['hydrostatic', 'maasp']);
    expect(grouped.production?.map((e) => e.name)).toEqual(['arps_exponential']);
    expect(grouped.conversions?.map((e) => e.name)).toEqual(['psi_to_bar']);
  });

  it('returns families in roadmap order: drilling, production, conversions', () => {
    expect(sortedFamilies(groupByFamily(entries))).toEqual([
      'drilling',
      'production',
      'conversions',
    ]);
  });

  it('puts unknown families after the known ones, alphabetised', () => {
    const grouped = {
      drilling: [HYDROSTATIC],
      foxtrot: [HYDROSTATIC],
      alpha: [HYDROSTATIC],
    };
    expect(sortedFamilies(grouped)).toEqual(['drilling', 'alpha', 'foxtrot']);
  });

  it('familyLabel humanises known families and falls through unknown ones', () => {
    expect(familyLabel('drilling')).toBe('Drilling');
    expect(familyLabel('production')).toBe('Production');
    expect(familyLabel('conversions')).toBe('Conversions');
    expect(familyLabel('other')).toBe('other');
  });
});
