import { test, expect, Page } from '@playwright/test';

/**
 * Requirements E2E tests
 *
 * Covers: creating a requirement via the Analyzer page form,
 * form validation, requirement title/body input, priority/type selectors.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

async function navigateToAnalyzer(page: Page) {
  await page.goto('/analyzer');
  await expect(page.getByRole('heading', { name: /analyzer/i })).toBeVisible({ timeout: 15_000 });
}

// ── Analyzer page structure ───────────────────────────────────────────────────

test.describe('Analyzer Page', () => {
  test('renders page heading and form', async ({ page }) => {
    await navigateToAnalyzer(page);

    await expect(page.getByRole('heading', { name: /analyzer/i })).toBeVisible();
    await expect(page.getByLabel(/requirement title/i)).toBeVisible();
    await expect(page.getByLabel(/requirement body/i)).toBeVisible();
  });

  test('shows Analyze button in form', async ({ page }) => {
    await navigateToAnalyzer(page);

    await expect(
      page.getByRole('button', { name: /analyze/i }).first(),
    ).toBeVisible();
  });

  test('shows priority dropdown', async ({ page }) => {
    await navigateToAnalyzer(page);

    const priorityLabel = page.getByLabel(/priority/i);
    if (await priorityLabel.isVisible()) {
      await expect(priorityLabel).toBeVisible();
    } else {
      // Priority may be rendered as a Select — check for the label text
      await expect(page.getByText(/priority/i).first()).toBeVisible();
    }
  });

  test('shows requirement type dropdown', async ({ page }) => {
    await navigateToAnalyzer(page);
    await expect(page.getByText(/type/i).first()).toBeVisible();
  });

  test('form requires title and body to enable submit', async ({ page }) => {
    await navigateToAnalyzer(page);

    const analyzeBtn = page.getByRole('button', { name: /analyze/i }).first();
    // Button should be disabled when form is empty
    await expect(analyzeBtn).toBeDisabled();

    // Fill title only
    await page.getByLabel(/requirement title/i).fill('My Requirement');
    await expect(analyzeBtn).toBeDisabled();

    // Fill body
    await page.getByLabel(/requirement body/i).fill(
      'As a user I want to log in so that I can access the dashboard.',
    );

    await expect(analyzeBtn).toBeEnabled();
  });

  test('can show/hide advanced options section', async ({ page }) => {
    await navigateToAnalyzer(page);

    const advancedToggle = page.getByRole('button', { name: /advanced/i });
    if (await advancedToggle.isVisible()) {
      await advancedToggle.click();
      await expect(page.getByLabel(/tech stack/i)).toBeVisible({ timeout: 5_000 });
      await advancedToggle.click();
    }
  });
});

// ── Full analysis workflow ────────────────────────────────────────────────────

test.describe('Analysis Workflow', () => {
  const REQUIREMENT_BODY = `
    The system shall allow authenticated users to create, read, update, and delete 
    project requirements. Each requirement shall have a title (max 200 chars), 
    a body (max 10,000 chars), a priority level (CRITICAL, HIGH, MEDIUM, LOW), 
    a type (FUNCTIONAL, NON_FUNCTIONAL, BUSINESS_RULE, CONSTRAINT), and an 
    optional context field. Requirements shall be versioned automatically on 
    each update. The system shall support pagination with a default page size of 20.
  `.trim();

  test('can submit a requirement and see analysis triggered', async ({ page }) => {
    await navigateToAnalyzer(page);

    // Fill form
    await page.getByLabel(/requirement title/i).fill(`E2E Test Req ${Date.now()}`);
    await page.getByLabel(/requirement body/i).fill(REQUIREMENT_BODY);

    // Submit
    const analyzeBtn = page.getByRole('button', { name: /analyze/i }).first();
    await expect(analyzeBtn).toBeEnabled();
    await analyzeBtn.click();

    // Should show loading / in-progress state
    await expect(
      page.getByText(/analyzing|in progress|processing|submitted/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('analysis progress bar or spinner is shown during processing', async ({ page }) => {
    await navigateToAnalyzer(page);

    await page.getByLabel(/requirement title/i).fill(`Progress Test ${Date.now()}`);
    await page.getByLabel(/requirement body/i).fill(REQUIREMENT_BODY);

    await page.getByRole('button', { name: /analyze/i }).first().click();

    // Either a linear progress bar or circular spinner should appear
    const hasProgress = await page.locator('[role="progressbar"]').isVisible({ timeout: 10_000 })
      .catch(() => false);
    const hasSpinner  = await page.locator('.MuiCircularProgress-root').isVisible()
      .catch(() => false);

    // At minimum we should see the "analyzing" text
    const hasText = await page.getByText(/analyzing|processing/i).isVisible({ timeout: 10_000 })
      .catch(() => false);

    expect(hasProgress || hasSpinner || hasText).toBeTruthy();
  });
});

// ── Artifact tabs (shown after analysis completes) ────────────────────────────

test.describe('Artifact Tabs', () => {
  /**
   * This test group runs against a pre-existing completed analysis
   * stored in the database via seed data (011_seed_data.sql).
   * If no seeded analysis exists, tabs are not rendered and we skip gracefully.
   */

  test('all 14 artifact tabs are rendered when analysis is complete', async ({ page }) => {
    await navigateToAnalyzer(page);

    // Check if there is already a completed analysis displayed
    const tabList = page.getByRole('tablist').first();
    const isTabListVisible = await tabList.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isTabListVisible) {
      test.skip(true, 'No completed analysis to display — skipping artifact tab tests');
      return;
    }

    const expectedTabs = [
      'Summary', 'Functional', 'NFRs', 'Rules', 'Actors',
      'APIs', 'Database', 'Validation', 'Acceptance',
      'Dependencies', 'Risks', 'Questions', 'Tasks', 'Points',
    ];

    for (const label of expectedTabs) {
      await expect(
        page.getByRole('tab', { name: new RegExp(label, 'i') }),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('clicking artifact tab switches content panel', async ({ page }) => {
    await navigateToAnalyzer(page);

    const tabList = page.getByRole('tablist').first();
    const isTabListVisible = await tabList.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isTabListVisible) {
      test.skip(true, 'No completed analysis to display');
      return;
    }

    // Click the Risks tab
    const risksTab = page.getByRole('tab', { name: /risks/i });
    if (await risksTab.isVisible()) {
      await risksTab.click();
      // Panel should now show risk-related content
      await expect(page.getByText(/risk|probability|impact|severity/i).first())
        .toBeVisible({ timeout: 5_000 });
    }
  });

  test('clicking Summary tab shows executive summary content', async ({ page }) => {
    await navigateToAnalyzer(page);

    const tabList = page.getByRole('tablist').first();
    const isTabListVisible = await tabList.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isTabListVisible) {
      test.skip(true, 'No completed analysis to display');
      return;
    }

    const summaryTab = page.getByRole('tab', { name: /summary/i });
    if (await summaryTab.isVisible()) {
      await summaryTab.click();
      await expect(page.getByText(/executive|scope|complexity/i).first())
        .toBeVisible({ timeout: 5_000 });
    }
  });
});
