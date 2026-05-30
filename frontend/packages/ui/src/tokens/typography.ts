/**
 * Type scale. Body is 16 px so AA text contrast at minimum size is honest.
 * Mono is used for tool inputs/outputs in the chat working panel.
 */
export const typography = {
  fontFamily: {
    sans:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    mono:
      "ui-monospace, SFMono-Regular, Menlo, 'JetBrains Mono', 'Cascadia Code', monospace",
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;
