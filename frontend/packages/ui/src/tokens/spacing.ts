/**
 * 4-px-based spacing scale. Numbered keys mirror Tailwind so the same scale
 * is usable in both className strings and inline styles. Values in px.
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  14: 56, // minimum touch target for the field app
  16: 64,
  20: 80,
} as const;

export type SpacingToken = keyof typeof spacing;
