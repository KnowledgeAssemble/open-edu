import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const widgetRegistryDir = resolve(__dirname, '.openedu-widget-registry');

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.mjs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60000,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @open-edu/learner dev',
      url: 'http://localhost:4001',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command:
        'pnpm --filter @open-edu/dev-server exec vite --mode browser --port 4002 --open false',
      url: 'http://localhost:4002',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        ...process.env,
        OPEN_EDU_WIDGET_REGISTRY: widgetRegistryDir,
        OPEN_EDU_WIDGET_REGISTRY_ID: 'localdev',
        OPEN_EDU_PACKS_DIR: 'examples/packs',
      },
    },
  ],
});
