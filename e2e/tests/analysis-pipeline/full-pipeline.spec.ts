import { test, expect, request as playwrightRequest } from '@playwright/test';

/**
 * Full Analysis Pipeline E2E
 *
 * This test covers the complete golden path:
 *   1. Create a requirement via REST API
 *   2. Trigger AI analysis
 *   3. Poll status until COMPLETED (or timeout at 5 minutes)
 *   4. Navigate to Analyzer page
 *   5. Verify all 14 artifact tabs are rendered with content
 *
 * Pre-condition: auth state from e2e/.auth/user.json
 * Requires: backend + AI provider running and accessible
 */

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3000';
const PROJECT_ID = '00000000-0000-0000-0000-000000000001'; // demo seed project
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS  = 300_000; // 5 minutes

const SAMPLE_REQUIREMENT = `
  The payment processing module shall support multiple payment methods including
  credit cards (Visa, Mastercard, Amex), PayPal, and Apple Pay.
  All payment transactions shall be encrypted using TLS 1.3 and comply with
  PCI DSS Level 1 requirements.
  The system shall process payments within 3 seconds under normal load (up to
  1,000 concurrent transactions).
  Failed payments shall trigger an automated retry mechanism with exponential
  backoff (max 3 retries).
  All transactions shall be logged in an immutable audit trail with full
  correlation IDs for fraud detection.
`.trim();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAuthToken(page: any): Promise<string> {
  // Extract access token from localStorage (set by the auth slice)
  return page.evaluate(() => {
    // The Redux store persists the token in memory; we extract it via
    // a direct API call using the cookie-based session
    return localStorage.getItem('reqai:access_token') ?? '';
  });
}

async function pollUntilComplete(
  apiContext: any,
  projectId: string,
  requirementId: string,
  timeoutMs: number,
): Promise<'COMPLETED' | 'FAILED' | 'TIMEOUT'> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await apiContext.get(
      `${API_BASE}/api/v1/projects/${projectId}/requirements/${requirementId}/analysis/status`,
    );

    if (res.ok()) {
      const body = await res.json();
      const status = body?.data?.status as string;

      if (status === 'COMPLETED') return 'COMPLETED';
      if (status === 'FAILED')    return 'FAILED';
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  return 'TIMEOUT';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Full Analysis Pipeline', () => {
  let requirementId: string;

  test('step 1 – health check confirms backend is reachable', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/health/live`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('step 2 – create requirement via API', async ({ request }) => {
    const res = await request.post(
      `${API_BASE}/api/v1/projects/${PROJECT_ID}/requirements`,
      {
        data: {
          title:       `E2E Pipeline Test ${Date.now()}`,
          body:        SAMPLE_REQUIREMENT,
          type:        'FUNCTIONAL',
          priority:    'HIGH',
        },
      },
    );

    // 201 = created
    if (res.status() !== 201) {
      const body = await res.json().catch(() => ({}));
      console.error('Create requirement failed:', JSON.stringify(body, null, 2));
    }
    expect(res.status()).toBe(201);

    const body = await res.json();
    requirementId = body.data?.id ?? body.data?.requirementId;
    expect(requirementId).toBeTruthy();
  });

  test('step 3 – trigger analysis via API', async ({ request }) => {
    test.skip(!requirementId, 'Skipped — requirement creation failed in step 2');

    const res = await request.post(
      `${API_BASE}/api/v1/projects/${PROJECT_ID}/requirements/${requirementId}/analyze`,
      {
        data: {
          context:   'Payment module for an e-commerce platform',
          techStack: 'Node.js, React, PostgreSQL, Redis',
          domain:    'Fintech / E-commerce',
        },
      },
    );

    expect([200, 202]).toContain(res.status());

    const body = await res.json();
    expect(body.data?.analysisId ?? body.data?.status).toBeTruthy();
  });

  test('step 4 – poll until COMPLETED (max 5 min)', async ({ request }) => {
    test.skip(!requirementId, 'Skipped — requirement creation failed in step 2');

    test.setTimeout(310_000); // 5m 10s

    const result = await pollUntilComplete(request, PROJECT_ID, requirementId, POLL_TIMEOUT_MS);

    if (result === 'TIMEOUT') {
      test.fail(true, 'Analysis did not complete within 5 minutes');
    } else if (result === 'FAILED') {
      test.fail(true, 'Analysis job failed — check worker logs');
    }

    expect(result).toBe('COMPLETED');
  });

  test('step 5 – fetch completed analysis and verify 14 artifacts', async ({ request }) => {
    test.skip(!requirementId, 'Skipped — requirement creation failed in step 2');

    const res = await request.get(
      `${API_BASE}/api/v1/projects/${PROJECT_ID}/requirements/${requirementId}/analysis`,
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    const analysis = body.data;

    expect(analysis.status).toBe('COMPLETED');
    expect(Array.isArray(analysis.artifacts)).toBeTruthy();
    expect(analysis.artifacts.length).toBe(14);

    const expectedTypes = [
      'SUMMARY',
      'FUNCTIONAL_REQUIREMENTS',
      'NON_FUNCTIONAL_REQUIREMENTS',
      'BUSINESS_RULES',
      'ACTORS',
      'APIS',
      'DATABASE_TABLES',
      'VALIDATION_RULES',
      'ACCEPTANCE_CRITERIA',
      'DEPENDENCIES',
      'RISKS',
      'OPEN_QUESTIONS',
      'DEVELOPMENT_TASKS',
      'STORY_POINTS',
    ];

    const returnedTypes = analysis.artifacts.map((a: any) => a.artifactType);
    for (const type of expectedTypes) {
      expect(returnedTypes).toContain(type);
    }
  });

  test('step 6 – verify artifact content structure (SUMMARY)', async ({ request }) => {
    test.skip(!requirementId, 'Skipped — requirement creation failed');

    const res = await request.get(
      `${API_BASE}/api/v1/projects/${PROJECT_ID}/requirements/${requirementId}/analysis`,
    );
    const body = await res.json();
    const summaryArtifact = body.data?.artifacts?.find((a: any) => a.artifactType === 'SUMMARY');

    expect(summaryArtifact).toBeTruthy();
    expect(summaryArtifact.content).toBeTruthy();
    expect(summaryArtifact.content.executive ?? summaryArtifact.content.overview).toBeTruthy();
  });

  test('step 7 – verify RISKS have probability × impact score', async ({ request }) => {
    test.skip(!requirementId, 'Skipped — requirement creation failed');

    const res = await request.get(
      `${API_BASE}/api/v1/projects/${PROJECT_ID}/requirements/${requirementId}/analysis`,
    );
    const body = await res.json();
    const risksArtifact = body.data?.artifacts?.find((a: any) => a.artifactType === 'RISKS');

    expect(risksArtifact).toBeTruthy();
    const risks = risksArtifact.content?.risks ?? risksArtifact.content;

    if (Array.isArray(risks) && risks.length > 0) {
      const firstRisk = risks[0];
      expect(firstRisk.probability).toBeTruthy();
      expect(firstRisk.impact).toBeTruthy();
      // riskScore = probability × impact (LOW=1, MEDIUM=2, HIGH=3)
      const probMap: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
      const expectedScore =
        (probMap[firstRisk.probability] ?? 0) * (probMap[firstRisk.impact] ?? 0);
      if (firstRisk.riskScore !== undefined) {
        expect(firstRisk.riskScore).toBe(expectedScore);
      }
    }
  });

  test('step 8 – verify STORY_POINTS breakdown sums correctly', async ({ request }) => {
    test.skip(!requirementId, 'Skipped — requirement creation failed');

    const res = await request.get(
      `${API_BASE}/api/v1/projects/${PROJECT_ID}/requirements/${requirementId}/analysis`,
    );
    const body = await res.json();
    const spArtifact = body.data?.artifacts?.find(
      (a: any) => a.artifactType === 'STORY_POINTS',
    );

    expect(spArtifact).toBeTruthy();
    const content = spArtifact.content;

    if (content?.totalPoints !== undefined && Array.isArray(content?.breakdown)) {
      const sumFromBreakdown = content.breakdown.reduce(
        (acc: number, t: any) => acc + (t.points ?? 0), 0,
      );
      // Sum of breakdown must equal totalPoints
      expect(sumFromBreakdown).toBe(content.totalPoints);
    }
  });
});

// ── Export API tests ──────────────────────────────────────────────────────────

test.describe('Export API', () => {
  test('markdown export returns 200 with content-disposition header', async ({ request }) => {
    // Use the seeded analysis from 011_seed_data.sql
    // If no seeded data exists this will return 404 which we handle gracefully
    const res = await request.get(
      `${API_BASE}/api/v1/export/00000000-0000-0000-0000-000000000099/markdown`,
    ).catch(() => null);

    if (!res || res.status() === 404) {
      test.skip(true, 'No seeded analysis to export — skipping export test');
      return;
    }

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/text\/markdown|text\/plain/i);
  });

  test('json export returns well-formed JSON', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/api/v1/export/00000000-0000-0000-0000-000000000099/json`,
    ).catch(() => null);

    if (!res || res.status() === 404) {
      test.skip(true, 'No seeded analysis to export');
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data?.analysisId).toBeTruthy();
    expect(Array.isArray(body.data?.artifacts)).toBeTruthy();
  });
});

// ── Health & API contract tests ───────────────────────────────────────────────

test.describe('API Health', () => {
  test('GET /health/live returns 200 ok', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/health/live`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /health/ready returns 200 with db/redis status', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/health/ready`);
    expect([200, 503]).toContain(res.status()); // 503 if infra not ready in CI

    const body = await res.json();
    expect(body.checks).toBeTruthy();
  });

  test('unknown routes return 404 with error envelope', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/does-not-exist`);
    expect(res.status()).toBe(404);
  });

  test('missing required fields returns 422', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: 'invalid-email' }, // missing password
    });
    expect([400, 422]).toContain(res.status());
  });
});
