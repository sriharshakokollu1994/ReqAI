import { z } from 'zod';

// ─── Schema ───────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // ── Application ────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT:     z.coerce.number().int().positive().default(3000),

  // ── Database ───────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis connection URL').default('redis://localhost:6379'),

  // ── JWT ────────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET:      z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET:     z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN:  z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // ── AI Provider ────────────────────────────────────────────────────────────
  AI_PROVIDER: z.enum(['OPENAI', 'AZURE_OPENAI', 'ANTHROPIC', 'WATSONX', 'CUSTOM']).default('OPENAI'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL:   z.string().default('gpt-4o'),

  // Azure OpenAI
  AZURE_OPENAI_API_KEY:  z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),

  // IBM watsonx.ai
  WATSONX_API_KEY:    z.string().optional(),
  WATSONX_PROJECT_ID: z.string().optional(),
  WATSONX_URL:        z.string().url().optional(),
  WATSONX_MODEL:      z.string().optional(),

  // ── Security ───────────────────────────────────────────────────────────────
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(16).default(12),

  // ── CORS ───────────────────────────────────────────────────────────────────
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').default('http://localhost:5173'),

  // ── Logging ────────────────────────────────────────────────────────────────
  LOG_LEVEL:   z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_TO_FILE: z.enum(['true', 'false']).transform((v) => v === 'true').default('false'),

  // ── Rate Limiting ──────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX:       z.coerce.number().int().positive().default(100),

  // ── Email (optional) ───────────────────────────────────────────────────────
  SMTP_HOST:  z.string().optional(),
  SMTP_PORT:  z.coerce.number().int().positive().optional(),
  SMTP_USER:  z.string().optional(),
  SMTP_PASS:  z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // ── S3 (optional) ──────────────────────────────────────────────────────────
  S3_BUCKET:            z.string().optional(),
  S3_REGION:            z.string().optional(),
  AWS_ACCESS_KEY_ID:    z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
});

// ─── Parse and fail fast ──────────────────────────────────────────────────────

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Use console.error here — logger depends on env, so it may not be ready
  console.error('\n❌  Invalid environment configuration:\n');
  parsed.error.issues.forEach((issue) => {
    console.error(`  [${issue.path.join('.')}] ${issue.message}`);
  });
  console.error('\nCopy .env.example → .env and fill in required values.\n');
  process.exit(1);
}

export const env = parsed.data;
export type Env  = typeof env;
