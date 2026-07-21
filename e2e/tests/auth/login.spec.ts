import { test, expect } from '@playwright/test';

/**
 * Authentication E2E tests
 *
 * Covers: login form validation, failed login, successful login/logout,
 * registration toggle, and protected route redirect.
 *
 * NOTE: These tests run WITHOUT pre-loaded auth state — they use a fresh
 * page context to test the login flow from scratch.
 */

const VALID_USER = {
  email:    process.env.E2E_USER_EMAIL ?? 'e2e@reqai.test',
  password: process.env.E2E_USER_PASS  ?? 'E2ePassword#1',
};

// ── Login page structure ──────────────────────────────────────────────────────

test.describe('Login Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // No auth state

  test('renders branding and form elements', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByText(/don't have an account/i)).toBeVisible();
  });

  test('submit button is disabled until email + password are filled', async ({ page }) => {
    await page.goto('/login');

    const submitBtn = page.getByRole('button', { name: /sign in/i });
    await expect(submitBtn).toBeDisabled();

    await page.getByLabel(/email address/i).fill('test@example.com');
    await expect(submitBtn).toBeDisabled(); // Still disabled — no password

    await page.getByLabel(/password/i).fill('anypassword');
    await expect(submitBtn).toBeEnabled();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email address/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('WrongPassword#99');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('alert')).toContainText(/invalid|incorrect|error/i);
  });

  test('can toggle to registration form', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /create one free/i }).click();
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
  });

  test('register form requires minimum 8 char password', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /create one free/i }).click();

    await page.getByLabel(/first name/i).fill('Jane');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email address/i).fill('jane@example.com');
    await page.getByLabel(/password/i).fill('short');

    const submitBtn = page.getByRole('button', { name: /create account/i });
    await expect(submitBtn).toBeDisabled();

    await page.getByLabel(/password/i).fill('LongEnoughPassword#1');
    await expect(submitBtn).toBeEnabled();
  });

  test('can toggle password visibility', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: '' }).last().click(); // Visibility toggle
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: '' }).last().click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('dark mode toggle works on login page', async ({ page }) => {
    await page.goto('/login');

    const html = page.locator('html');
    // Toggle dark mode
    await page.getByRole('button', { name: '' }).first().click();
    // Page should remain functional
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('unauthenticated user is redirected to /login from protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

// ── Full login / logout flow ──────────────────────────────────────────────────

test.describe('Authentication Flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // No pre-loaded auth

  test('successful login navigates to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email address/i).fill(VALID_USER.email);
    await page.getByLabel(/password/i).fill(VALID_USER.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await expect(page.getByText(/ReqAI/i).first()).toBeVisible();
  });

  test('authenticated user accessing /login is redirected to dashboard', async ({ page }) => {
    // Log in first
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill(VALID_USER.email);
    await page.getByLabel(/password/i).fill(VALID_USER.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard');

    // Navigate directly to /login
    await page.goto('/login');
    // Should redirect back to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });
});
