import { test, expect } from '@playwright/test';
import { resolve } from 'path';
import {
  startServer,
  tabTo,
  openStudioPreview,
  openPreviewDevtools,
  type TestServer,
} from './helpers';

const AUTISM = resolve('examples/autism-reading');
const HELLO_WORLD = resolve('examples/hello-world');

test.describe('keyboard navigation', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(HELLO_WORLD);
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('Next button receives focus via Tab', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);

    const nextButton = page.getByRole('button', { name: 'Next' });
    await tabTo(page, nextButton);
    await expect(nextButton).toBeFocused();
  });

  test('activates Next button with keyboard Enter', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);

    const nextButton = page.getByRole('button', { name: 'Next' });
    await tabTo(page, nextButton);
    await nextButton.press('Enter');
    await expect(page.getByText('You have completed this learning experience.')).toBeVisible();
  });
});

test.describe('accessibility validation', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(AUTISM);
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('page has proper landmark regions', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);

    const shell = page.getByTestId('layout-shell');
    await expect(shell).toBeVisible();

    const main = page.locator('main[aria-live="polite"]');
    await expect(main).toBeVisible();
  });

  test('inspector devtools drawer has complementary role', async ({ page }) => {
    await page.goto(server.url);
    await openPreviewDevtools(page);

    const inspector = page.getByRole('complementary', { name: /preview devtools/i });
    await expect(inspector).toBeVisible();
  });

  test('A11y inspector shows no violations after auto-audit', async ({ page }) => {
    await page.goto(server.url);
    await openPreviewDevtools(page);

    await page.getByRole('tab', { name: 'A11y' }).click();

    await expect(page.getByText('No accessibility violations found')).toBeVisible({
      timeout: 15000,
    });
  });

  test('Run Audit button is present and clickable', async ({ page }) => {
    await page.goto(server.url);
    await openPreviewDevtools(page);

    await page.getByRole('tab', { name: 'A11y' }).click();

    await expect(page.getByText('No accessibility violations found')).toBeVisible({
      timeout: 15000,
    });

    const runButton = page.getByRole('button', { name: /Run Audit|Running/ });
    await expect(runButton).toBeVisible();
    await runButton.click();
  });
});
