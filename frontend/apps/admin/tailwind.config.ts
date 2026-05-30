import type { Config } from 'tailwindcss';
import preset from '@petrobrain/ui/tailwind-preset';

const config: Config = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {},
  plugins: [],
};

export default config;
