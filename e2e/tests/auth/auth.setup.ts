import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Auth Setup — runs once before all test projects.
 *
 * 1. Registers the test user via REST API (409 = already exists → OK)
 * 2. Performs a full browser login
 * 3. Saves session storage state to tests/auth/.auth/user.json
 *    so all downstream test workers can reuse the authenticated session.
 */

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

const TEST_USER = {
  firstName: 'E2E',
  lastName:  'Tester',
  email:     process.env.E2E_USER_EMAIL ?? 'e2e@reqai.test',
  password:  process.env.E2E_USER_PASS  ?? 'E2ePassword#1',
};

setup('authenticate', async ({ page, request }) => {
  // ── 1. Ensure test user exists ─────────────────────────────────────────────
  const registerRes = await request.post(
    `${process.env.E2E_API_URL ?? 'http://localhost:3000'}/api/v1/auth/register`,
    { data: TEST_USER },
  );

  // 201 = created, 409 = already exists — both acceptable
  if (registerRes.status() !== 201 && registerRes.status() !== 409) {
    throw new Error(
      `Unexpected register status ${registerRes.status()}: ${await registerRes.text()}`,
    );
  }

  // ── 2. Navigate to login page ──────────────────────────────────────────────
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 15_000 });

  // ── 3. Fill login form ─────────────────────────────────────────────────────
  await page.getByLabel(/email address/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // ── 4. Wait for redirect to dashboard ─────────────────────────────────────
  await page.waitForURL('**/dashboard', { timeout: 15_000 });

  // ── 5. Persist auth state ──────────────────────────────────────────────────
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✅ Auth state saved to ${AUTH_FILE}`);
});
