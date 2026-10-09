import { test, expect, type Page } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4002';

async function openStudio(page: Page): Promise<void> {
  await page.goto(STUDIO_URL);
  await expect(page.getByRole('heading', { name: 'Create a course' })).toBeVisible({
    timeout: 30000,
  });
}

test.describe('Pack selection (Phase 1)', () => {
  test('select a curriculum pack → create → browse concepts in the Packs tab', async ({ page }) => {
    await openStudio(page);

    // Pack selection section is visible on Home.
    await expect(
      page.getByRole('heading', { name: 'Create from a curriculum pack' }),
    ).toBeVisible();

    // Choose the curriculum + unit from the example packs (OPEN_EDU_PACKS_DIR=examples/packs).
    await page.getByRole('combobox', { name: 'Curriculum' }).click();
    await page.getByRole('option', { name: 'NIOS Mathematics Level A' }).click();
    await page.getByRole('combobox', { name: 'Unit' }).click();
    await page.getByRole('option', { name: 'Fractions' }).click();
    await page.getByRole('button', { name: 'Create Learning Experience' }).click();

    // The assistant opens, prefilled with a pack-grounded course prompt mentioning the unit.
    const composer = page.getByRole('textbox', { name: /Ask anything about your course/ });
    try {
      await expect(composer).toHaveValue(/selected curriculum unit: Fractions/, {
        timeout: 15000,
      });
    } catch (err) {
      const railCount = await page.getByRole('button', { name: 'Open Author Assistant' }).count();
      const errorBanner = await page.locator('[role="alert"]').allTextContents();
      const bodyText = await page.locator('body').innerText();
      console.log('DIAG rail-assistant-count=' + railCount);
      console.log('DIAG alerts=' + JSON.stringify(errorBanner));
      console.log('DIAG body-excerpt=' + bodyText.slice(0, 1500).replace(/\n/g, ' | '));
      throw err;
    }

    // Reach the outline (create a template course), then open the Packs tab.
    await page.getByRole('button', { name: 'Lesson + quiz' }).click();
    await page.getByRole('button', { name: 'Use template' }).click();
    await page.getByRole('button', { name: 'Replace and continue' }).click();
    await expect(page.getByRole('heading', { name: 'Outline' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('tab', { name: 'Packs' }).click();
    await expect(page.getByText('openedu-fractions/fraction')).toBeVisible();
    await expect(page.getByText('openedu-fractions/numerator')).toBeVisible();
    await expect(page.getByText('openedu-fractions/denominator')).toBeVisible();
  });
});
