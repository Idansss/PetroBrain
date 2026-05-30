/**
 * Shared Tailwind preset.
 *
 * apps/web and apps/admin extend this so their utility classes resolve
 * to the same numeric tokens as the React primitives. Field app uses the
 * tokens directly via @petrobrain/ui/tokens.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f5fa',
          100: '#dde8f3',
          200: '#b7cde4',
          300: '#85a9cd',
          400: '#5085b3',
          500: '#1f5f96',
          600: '#194e7c',
          700: '#143e63',
          800: '#0f2f4b',
          900: '#0a2034',
        },
        safe: { fg: '#0e5132', bg: '#dff3e4', border: '#1f8a4c' },
        info: { fg: '#0a3d6b', bg: '#dfeefd', border: '#1f6fb8' },
        warn: { fg: '#7a4b00', bg: '#fdecd0', border: '#b87a14' },
        danger: { fg: '#7a1c1f', bg: '#fbdcdc', border: '#b8262a' },
      },
      borderRadius: {
        sm: '2px',
        md: '4px',
        lg: '8px',
        xl: '12px',
        pill: '9999px',
      },
      minHeight: { tap: '56px' },
      minWidth: { tap: '56px' },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', '"JetBrains Mono"', 'monospace'],
      },
    },
  },
};
