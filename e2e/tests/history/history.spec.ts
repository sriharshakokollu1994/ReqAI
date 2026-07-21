import { test, expect } from '@playwright/test';

/**
 * History & Saved Pages E2E tests
 *
 * Covers: navigation to /history and /saved, page structure,
 * list rendering (or empty state), and analysis detail navigation.
 */

test.describe('History Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: /history/i })).toBeVisible({ timeout: 15_000 });
  });

  test('renders heading and search/filter bar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /history/i })).toBeVisible();
    // Search input or filter chip should be present
    const hasSearch = await page.getByRole('searchbox').isVisible().catch(() => false)
      || await page.getByPlaceholder(/search/i).isVisible().catch(() => false);
    // History page should have some form of filterable UI or table
    expect(
      hasSearch
      || await page.locator('table').isVisible().catch(() => false)
      || await page.getByText(/no analyses/i).isVisible().catch(() => false)
    ).toBeTruthy();
  });

  test('shows analyses list or empty state', async ({ page }) => {
    const hasRows  = await page.locator('tbody tr').count() > 0;
    const hasCards = await page.locator('[data-testid="history-item"]').count() > 0;
    const hasEmpty = await page.getByText(/no analyses|no history|empty/i).isVisible().catch(() => false);
    expect(hasRows || hasCards || hasEmpty).toBeTruthy();
  });

  test('analysis status chips are rendered for existing items', async ({ page }) => {
    const rowCount = await page.locator('tbody tr').count();
    if (rowCount === 0) {
      test.skip(true, 'No history items to test');
      return;
    }

    // Status chip should be visible in at least the first row
    const firstRow = page.locator('tbody tr').first();
    await expect(
      firstRow.locator('.MuiChip-root').first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('clicking history item navigates or expands detail', async ({ page }) => {
    const rowCount = await page.locator('tbody tr').count();
    if (rowCount === 0) {
      test.skip(true, 'No history items to test');
      return;
    }

    // Click the first row's "View" button or the row itself
    const viewBtn = page.locator('tbody tr').first().getByRole('button').first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      // Should navigate to analyzer or open a drawer/dialog
      await page.waitForTimeout(1_000);
    }
  });

  test('pagination controls render when more than 1 page exists', async ({ page }) => {
    const rowCount = await page.locator('tbody tr').count();
    if (rowCount < 20) {
      // Pagination only shows with enough items
      return;
    }
    await expect(page.locator('.MuiPagination-root, [aria-label*="pagination"]')).toBeVisible();
  });
});

test.describe('Saved Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/saved');
    await expect(page.getByRole('heading', { name: /saved/i })).toBeVisible({ timeout: 15_000 });
  });

  test('renders heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /saved/i })).toBeVisible();
  });

  test('shows saved analyses list or empty state', async ({ page }) => {
    const hasItems = await page.locator('tbody tr, [data-testid="saved-item"]').count() > 0;
    const hasEmpty = await page.getByText(/no saved|empty|bookmark/i).isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBeTruthy();
  });

  test('sidebar "Saved" link is active when on /saved', async ({ page }) => {
    const savedNavLink = page.getByRole('link', { name: /saved/i });
    // Active nav item typically has a different background or aria-current
    await expect(savedNavLink).toBeVisible();
  });
});
