import { test, expect } from '@playwright/test';
import { resolve } from 'path';
import { startServer, openStudioPreview, type TestServer } from './helpers';

const HELLO_WORLD = resolve('examples/hello-world');
const INTRO_JS = resolve('examples/intro-javascript');

test.describe('hello-world (single lesson node)', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(HELLO_WORLD);
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('loads and displays the package title', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    const title = page.getByRole('heading', { level: 1 }).first();
    await expect(title).toHaveText('Hello World');
  });

  test('renders markdown content from the lesson node', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await expect(page.getByText('Welcome to your first Open-Edu learning package!')).toBeVisible();
    await expect(
      page.getByText('Educational Packages are portable learning experiences'),
    ).toBeVisible();
  });

  test('shows progress bar on initial load', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    const progressbar = page.getByRole('progressbar').first();
    await expect(progressbar).toBeVisible();
  });

  test('clicks Next to complete the learning experience', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('You have completed this learning experience.')).toBeVisible();
  });

  test('completion hides the Next button', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('button', { name: 'Next' })).toBeHidden();
  });
});

test.describe('intro-javascript (multi-node linear)', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(INTRO_JS);
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('renders the first lesson node on load', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    const title = page.getByRole('heading', { level: 1 }).first();
    await expect(title).toHaveText('Introduction to JavaScript');
    await expect(page.getByText('JavaScript is a programming language')).toBeVisible();
  });

  test('navigates through all 4 nodes to completion', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Variables store data in JavaScript')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(
      page.getByText('Which of these correctly declares a JavaScript variable?'),
    ).toBeVisible();
    await page.getByLabel('let score = 0;').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: 'Congratulations!' })).toBeVisible();
    await expect(
      page.getByText("You've completed the Introduction to JavaScript lesson"),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('You have completed this learning experience.')).toBeVisible();
  });

  test('progress bar shows correct total', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(1000);
    const footer = page.locator('footer');
    await expect(footer.getByText('/ 4')).toBeVisible();
  });
});

test.describe('fractions (conditional branching)', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(resolve('examples/fractions'));
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('passes quiz with correct answer and reaches advanced node', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    const title = page.getByRole('heading', { level: 1 }).first();
    await expect(title).toHaveText('Understanding Fractions');
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Which statements about fractions are correct?')).toBeVisible();
    await page.getByLabel('1/2 is equivalent to 0.5').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Great work! You have a solid understanding')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('You have completed this learning experience.')).toBeVisible();
  });

  test('fails quiz with wrong answer and reaches remediation node', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.getByLabel('The denominator can be zero').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText("Let's review the basics again")).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('You have completed this learning experience.')).toBeVisible();
  });
});

test.describe('widget-practice (widget exercise)', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(resolve('examples/widget-practice'));
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('renders intro and navigates to widget', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await expect(page.getByRole('heading', { name: 'Widget Practice' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('What is the capital of France?')).toBeVisible();
  });

  test('selects correct answer and completes', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);
    await page.getByLabel('Paris').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Paris is the capital')).toBeVisible();
    await page.getByTestId('continue-button').click();
    await page.waitForTimeout(500);
    await expect(page.getByText('You have completed this learning experience.')).toBeVisible({
      timeout: 5000,
    });
  });

  test('selects wrong answer and completes', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);
    await page.getByLabel('London').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Incorrect')).toBeVisible();
  });
});

test.describe('adaptive-study (adaptive learning with remediation loop)', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(resolve('examples/adaptive-study'));
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('loads with correct title and intro content', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    const title = page.getByRole('heading', { level: 1 }).first();
    await expect(title).toHaveText('Adaptive Study');
    await expect(
      page.getByText('This learning experience adapts to your knowledge.'),
    ).toBeVisible();
  });

  test('passes checkpoint and reaches reflection', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(
      page.getByText('Which statements about adaptive learning are correct?'),
    ).toBeVisible();
    await page.getByLabel('Adaptive learning personalizes the path based on performance').click();
    await page.getByLabel('Remediation helps learners review challenging concepts').click();
    await page.getByLabel('Score-based branching directs learners to different nodes').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('How does adaptive learning differ')).toBeVisible();
  });

  test('fails checkpoint and reaches remediation', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.getByLabel('Adaptive learning uses the same path for all learners').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);

    await expect(
      page.getByRole('heading', { name: "Let's Review Adaptive Learning" }),
    ).toBeVisible();
  });
});

test.describe('skill-graph (mastery-based routing)', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(resolve('examples/skill-graph'));
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('passes basics quiz to unlock advanced quiz', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    const title = page.getByRole('heading', { level: 1 }).first();
    await expect(title).toHaveText('Algebra Skill Graph');
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Which statements about basic algebra are correct?')).toBeVisible();
    await page.getByLabel('An equation is a statement that two expressions are equal').click();
    await page.getByLabel('To solve x + 3 = 7, subtract 3 from both sides').click();
    await page.getByLabel('Multiplication and division are inverse operations').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);

    await expect(
      page.getByText('Which statements about advanced algebra are correct?'),
    ).toBeVisible();
    await page.getByLabel('A quadratic equation has the form ax² + bx + c = 0').click();
    await page.getByLabel('The quadratic formula solves for x in a quadratic equation').click();
    await page.getByLabel('Factoring is a method for solving quadratic equations').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: 'Algebra Mastery Complete' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('You have completed this learning experience.')).toBeVisible();
  });

  test('fails basics quiz and reaches remediation', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.getByLabel('The variable x always equals 5').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: "Let's Review Algebra" })).toBeVisible();
  });
});

test.describe('autism-reading (lesson → quiz → reflection)', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(resolve('examples/autism-reading'));
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('loads with correct title and lesson content', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    const title = page.getByRole('heading', { level: 1 }).first();
    await expect(title).toHaveText('A Day at the Park');
    await expect(page.getByText('Sam and Max went to the park')).toBeVisible();
  });

  test('navigates full journey: lesson → quiz → reflection → completion', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('What did Sam and Max do at the park?')).toBeVisible();
    await page.getByLabel('They fed the ducks').click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('How did Sam and Max feel at the end of the day?')).toBeVisible();
    await page.getByRole('textbox').fill('They felt happy after playing outside.');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText('You have completed this learning experience.')).toBeVisible();
  });
});

test.describe('interactive-demo (interactive engine nodes)', () => {
  let server: TestServer;

  test.beforeAll(async () => {
    server = await startServer(resolve('examples/interactive-demo'));
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('renders a single-engine interactive node with title', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await expect(
      page.getByRole('heading', { name: 'Interactive Engine Demo' }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('interactive-renderer')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Number line' })).toBeVisible();
    await expect(page.getByText('0 interactions')).not.toBeVisible();
  });

  test('shows prompt and responds to SVG interaction', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('interactive-renderer')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Number line' })).toBeVisible();
    await page.locator('#nl-marker-7').click({ timeout: 5000 });
    await page.getByRole('button', { name: 'Mark complete' }).click();
  });

  test('number-line practice shows prompt and label click', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Mark complete' }).click();

    await expect(page.getByTestId('interactive-renderer')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Number line practice' })).toBeVisible();
    await expect(page.getByText('Tap the emphasized number on the line.')).toBeVisible();
    await page.locator('#nl-label-7').click({ timeout: 5000 });
    await page.getByRole('button', { name: 'Mark complete' }).click();
  });

  test('completes the full interactive journey', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);

    await page.getByRole('button', { name: 'Next' }).click(); // intro → number-line
    for (const heading of [
      'Number line',
      'Number line practice',
      'Timeline drives visual focus',
      'Identify Odisha (guided)',
      'Two-stage water cycle',
      'Frog lifecycle',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 5000 });
      const markComplete = page.getByRole('button', { name: 'Mark complete' });
      await expect(markComplete).toBeEnabled({ timeout: 5000 });
      await markComplete.click();
    }
    await expect(page.getByRole('button', { name: 'Identify the Capital of Odisha' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('renders host figures and the text alternative beside diagram nodes', async ({ page }) => {
    await page.goto(server.url);
    await openStudioPreview(page);

    await page.getByRole('button', { name: 'Next' }).click();
    for (const heading of [
      'Number line',
      'Number line practice',
      'Timeline drives visual focus',
      'Identify Odisha (guided)',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 5000 });
      const markComplete = page.getByRole('button', { name: 'Mark complete' });
      await expect(markComplete).toBeEnabled({ timeout: 5000 });
      await markComplete.click();
    }

    await expect(page.getByRole('heading', { name: 'Two-stage water cycle' })).toBeVisible({
      timeout: 5000,
    });

    const img = page.locator('[data-testid="figure-overlay"] img');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('alt', 'Simple sketch of the water cycle');

    const alternative = page.getByTestId('interactive-alternative');
    await alternative.locator('summary').click();
    await expect(alternative).toContainText('Cycle');
    await expect(alternative).toContainText('Water enters the cycle.');
  });
});
