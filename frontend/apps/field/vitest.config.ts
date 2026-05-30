import { defineConfig } from 'vitest/config';

/**
 * The field app is React Native; component tests need jest-expo. For now
 * Vitest only covers the pure-TS slices of ``src/lib`` (search, settings
 * reducer, etc.). The include glob is narrow so we never accidentally
 * try to load a file that imports react-native or expo.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
