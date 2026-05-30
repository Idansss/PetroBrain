import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/lib\/(.*)$/, replacement: resolve(here, 'lib/$1') },
      { find: /^@\/(.*)$/, replacement: resolve(here, 'app/$1') },
      { find: '@petrobrain/ui', replacement: resolve(here, '../../packages/ui/src/index.ts') },
      { find: '@petrobrain/types', replacement: resolve(here, '../../packages/types/src/index.ts') },
      { find: '@petrobrain/api', replacement: resolve(here, '../../packages/api/src/index.ts') },
    ],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['app/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    css: false,
  },
});
