import { test, expect } from '@playwright/test';
import { resolve } from 'path';
import { startServer, openStudioPreview, openPreviewDevtools, type TestServer } from './helpers';

const HELLO_WORLD = resolve('examples/hello-world');

test.describe('telemetry event capture', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(HELLO_WORLD);
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('shows empty state before any interaction', async ({ page }) => {
    await page.goto(server.url);
    await openPreviewDevtools(page);
    await expect(page.getByText('No telemetry events yet')).toBeVisible();
  });

  test('captures telemetry events after completing the lesson', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: /open devtools/i }).click();
    const panel = page.getByRole('complementary', { name: /preview devtools/i });
    await expect(panel.getByText(/node:/).first()).toBeVisible({ timeout: 15000 });
  });
});
