import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFERENCES,
  fontScale,
  preferencesReducer,
  SUPPORTED_LANGUAGES,
} from './preferences.js';

describe('preferencesReducer', () => {
  it('returns the same state for unsupported languages', () => {
    const next = preferencesReducer(DEFAULT_PREFERENCES, { type: 'setLanguage', language: 'yo' });
    expect(next.language).toBe('en');
    expect(SUPPORTED_LANGUAGES.has('yo')).toBe(false);
  });

  it('honours supported languages', () => {
    const next = preferencesReducer(DEFAULT_PREFERENCES, { type: 'setLanguage', language: 'en' });
    expect(next.language).toBe('en');
  });

  it('moves text size up and back down', () => {
    const big = preferencesReducer(DEFAULT_PREFERENCES, { type: 'setTextSize', textSize: 'large' });
    expect(big.textSize).toBe('large');
    const small = preferencesReducer(big, { type: 'setTextSize', textSize: 'small' });
    expect(small.textSize).toBe('small');
  });

  it('resets to the default state', () => {
    const mutated = preferencesReducer(DEFAULT_PREFERENCES, {
      type: 'setTextSize',
      textSize: 'large',
    });
    expect(preferencesReducer(mutated, { type: 'reset' })).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('fontScale', () => {
  it.each([
    ['small', 0.9],
    ['medium', 1],
    ['large', 1.25],
  ] as const)('maps %s → %s', (size, scale) => {
    expect(fontScale(size)).toBe(scale);
  });
});
