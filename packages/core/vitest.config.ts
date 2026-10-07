import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    poolMatchGlobs: [['**/geo-assets.test.ts', 'forks']],
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
