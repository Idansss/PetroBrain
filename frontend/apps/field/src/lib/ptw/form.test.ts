import { describe, expect, it } from 'vitest';

import { ptwFormReducer, validatePtwForm } from './form.js';
import { EMPTY_PTW_FORM, type PtwFormState } from './types.js';

const sample = (overrides: Partial<PtwFormState> = {}): PtwFormState => ({
  ...EMPTY_PTW_FORM,
  job_description: 'Replace gasket',
  location: 'K-101',
  ...overrides,
});

describe('ptwFormReducer', () => {
  it('sets scalar fields', () => {
    const next = ptwFormReducer(EMPTY_PTW_FORM, {
      type: 'set_field',
      field: 'location',
      value: 'K-101',
    });
    expect(next.location).toBe('K-101');
  });

  it('rejects unknown work types defensively', () => {
    const next = ptwFormReducer(EMPTY_PTW_FORM, {
      type: 'set_work_type',
      value: 'tea_break' as never,
    });
    expect(next).toBe(EMPTY_PTW_FORM);
  });

  it('adds chips and dedupes case-sensitively', () => {
    let state = ptwFormReducer(sample(), { type: 'add_chip', field: 'hazards', value: 'Hot surfaces' });
    state = ptwFormReducer(state, { type: 'add_chip', field: 'hazards', value: '  Hot surfaces  ' });
    expect(state.hazards).toEqual(['Hot surfaces']);
  });

  it('ignores blank chips', () => {
    const state = ptwFormReducer(sample(), { type: 'add_chip', field: 'hazards', value: '   ' });
    expect(state.hazards).toEqual([]);
  });

  it('removes a chip by index, leaving others intact', () => {
    let state = sample();
    state = ptwFormReducer(state, { type: 'add_chip', field: 'controls', value: 'A' });
    state = ptwFormReducer(state, { type: 'add_chip', field: 'controls', value: 'B' });
    state = ptwFormReducer(state, { type: 'add_chip', field: 'controls', value: 'C' });
    state = ptwFormReducer(state, { type: 'remove_chip', field: 'controls', index: 1 });
    expect(state.controls).toEqual(['A', 'C']);
  });

  it('out-of-range remove_chip is a no-op', () => {
    const before = sample({ controls: ['A'] });
    const after = ptwFormReducer(before, { type: 'remove_chip', field: 'controls', index: 99 });
    expect(after).toBe(before);
  });

  it('replace_chips trims and dedupes', () => {
    const state = ptwFormReducer(sample(), {
      type: 'replace_chips',
      field: 'controls',
      values: ['  A', 'B', 'A ', '', 'B'],
    });
    expect(state.controls).toEqual(['A', 'B']);
  });

  it('reset returns the empty form', () => {
    expect(ptwFormReducer(sample({ location: 'foo' }), { type: 'reset' })).toEqual(EMPTY_PTW_FORM);
  });
});

describe('validatePtwForm', () => {
  it('returns an empty list for a valid form', () => {
    expect(validatePtwForm(sample())).toEqual([]);
  });

  it('reports missing job_description and location', () => {
    const errors = validatePtwForm(EMPTY_PTW_FORM);
    expect(errors).toContain('Job description is required.');
    expect(errors).toContain('Location is required.');
  });
});
