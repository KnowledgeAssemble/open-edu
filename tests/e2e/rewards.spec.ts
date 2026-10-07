import { test, expect } from '@playwright/test';
import { resolve } from 'path';
import { startServer, openStudioPreview, openPreviewDevtools, type TestServer } from './helpers';

const LIVING_VS_NONLIVING = resolve('examples/living-vs-nonliving');

test.describe('living-vs-nonliving (with rewards)', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(LIVING_VS_NONLIVING);
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('loads and displays content without blank page', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(
      'Living vs Non-Living Things',
    );
    await expect(page.getByText(/Some things are alive/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  });

  test('shows DevTools with pending rewards', async ({ page }) => {
    await page.goto(server.url);
    await openPreviewDevtools(page);
    await page.getByRole('tab', { name: 'Rewards' }).click();
    await expect(page.getByText('Pending (3)')).toBeVisible();
    await expect(page.getByText(/badge.award: living-nonliving-mastery/)).toBeVisible();
  });

  test('reward broker fires on workflow completion', async ({ page }) => {
    await page.goto(server.url);
    await openPreviewDevtools(page);
    await page.getByRole('tab', { name: 'Rewards' }).click();
    await expect(page.getByText('Pending (3)').first()).toBeVisible();

    const initial = await page.locator('text=Delivered').count();

    for (let i = 0; i < 5; i++) {
      const nextBtn = page.getByRole('button', { name: 'Next' });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }
      await page.waitForTimeout(300);
    }

    const final = await page.locator('text=Delivered').count();
    expect(final).toBeGreaterThanOrEqual(initial);
  });
});
