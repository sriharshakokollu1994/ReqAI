/**
 * Test environment setup
 *
 * Injects all required env vars before the Zod env schema runs.
 * This prevents process.exit(1) when running tests without a real .env file.
 */

// ── Database / Redis ────────────────────────────────────────────────────────
process.env['DATABASE_URL']  = 'postgresql://test:test@localhost:5432/reqai_test';
process.env['REDIS_URL']     = 'redis://localhost:6379';

// ── JWT ─────────────────────────────────────────────────────────────────────
process.env['JWT_ACCESS_SECRET']      = 'test-access-secret-at-least-32-chars!!';
process.env['JWT_REFRESH_SECRET']     = 'test-refresh-secret-at-least-32-chars!';
process.env['JWT_ACCESS_EXPIRES_IN']  = '15m';
process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';

// ── AI Provider ─────────────────────────────────────────────────────────────
process.env['AI_PROVIDER']    = 'OPENAI';
process.env['OPENAI_API_KEY'] = 'sk-test-key';
process.env['OPENAI_MODEL']   = 'gpt-4o';

// ── General ─────────────────────────────────────────────────────────────────
process.env['NODE_ENV']      = 'test';
process.env['LOG_LEVEL']     = 'error'; // suppress info/debug logs in test output
process.env['FRONTEND_URL']  = 'http://localhost:5173';
process.env['BCRYPT_ROUNDS'] = '4';    // low rounds for fast test hashing
