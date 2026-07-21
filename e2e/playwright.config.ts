import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load backend .env so E2E tests can inherit SMTP + JWT vars if needed
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

/**
 * ReqAI – E2E Playwright Configuration
 * ─────────────────────────────────────
 * Run order:
 *   1. "setup" project  → auth.setup.ts  (creates test user + saves auth state)
 *   2. "chromium" / "firefox" / "mobile-chrome" → all .spec.ts files
 *
 * Environment variables (override via .env or shell):
 *   E2E_BASE_URL  — frontend base URL  (default: http://localhost:5173)
 *   E2E_API_URL   — backend API URL    (default: http://localhost:3000)
 *   E2E_USER_EMAIL — test user email   (default: e2e@reqai.test)
 *   E2E_USER_PASS  — test user password (default: E2ePassword#1)
 */
export default defineConfig({
  testDir:        './tests',
  fullyParallel:  false,          // Serial — tests share DB state
  forbidOnly:     !!process.env.CI,
  retries:        process.env.CI ? 2 : 0,
  workers:        1,              // One worker to avoid race conditions
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'],   ['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],

  use: {
    baseURL:           process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace:             'on-first-retry',
    screenshot:        'only-on-failure',
    video:             'retain-on-failure',
    actionTimeout:     15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // ── Step 0: Auth setup (runs once) ──────────────────────────────────────
    {
      name:      'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // ── Step 1: Chromium (primary) ───────────────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/auth/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ── Step 2: Firefox ──────────────────────────────────────────────────────
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'tests/auth/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ── Step 3: Mobile Chrome ────────────────────────────────────────────────
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        storageState: 'tests/auth/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Start the dev servers automatically when not in CI
  webServer: process.env.CI
    ? undefined
    : {
        command:            'npm run dev --prefix ../frontend',
        url:                'http://localhost:5173',
        reuseExistingServer: true,
        timeout:            60_000,
      },
});
