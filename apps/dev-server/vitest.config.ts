import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'resolve-virtual-module',
      resolveId(id: string) {
        if (id === 'virtual:open-edu-package') return '\0virtual:open-edu-package';
      },
      load(id: string) {
        if (id === '\0virtual:open-edu-package') {
          return 'export const packageData = null;';
        }
      },
    },
    {
      name: 'resolve-virtual-packs',
      resolveId(id: string) {
        if (id === 'virtual:open-edu-packs') return '\0virtual:open-edu-packs';
      },
      load(id: string) {
        if (id === '\0virtual:open-edu-packs') {
          return 'export const packData = null;';
        }
      },
    },
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 75,
        lines: 75,
      },
      exclude: ['dist/**', '**/*.test.*', '**/__fixtures__/**', '**/test-setup.*'],
    },
  },
});
