import winston from 'winston';
import path from 'path';
import fs from 'fs';

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_NAME = 'reqai-backend';
const LOG_DIR      = path.resolve(process.cwd(), 'logs');
const IS_PROD      = process.env.NODE_ENV === 'production';
const IS_TEST      = process.env.NODE_ENV === 'test';

// ─── Log levels (RFC 5424 aligned) ───────────────────────────────────────────
//
//   error   — unrecoverable failures, 5xx responses, unhandled exceptions
//   warn    — recoverable issues, 4xx responses, slow requests
//   info    — normal lifecycle events (startup, auth, AI completions)
//   http    — individual HTTP request/response records
//   debug   — detailed diagnostic data (query plans, token counts)
//
export const LOG_LEVELS = {
  error: 0,
  warn:  1,
  info:  2,
  http:  3,
  debug: 4,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

// ─── Custom colours for dev console ──────────────────────────────────────────

winston.addColors({
  error: 'bold red',
  warn:  'bold yellow',
  info:  'bold green',
  http:  'bold cyan',
  debug: 'bold magenta',
});

// ─── Formats ──────────────────────────────────────────────────────────────────

const { combine, timestamp, json, errors, colorize, printf, metadata } = winston.format;

/** Structured JSON format for files and production console. */
const jsonFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  metadata({ fillExcept: ['message', 'level', 'timestamp', 'service'] }),
  json(),
);

/** Human-readable coloured format for development console. */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss.SSS' }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')
      : '';
    return `${ts} [${level}] ${message}${metaStr}`;
  }),
);

// ─── Transports ───────────────────────────────────────────────────────────────

function buildTransports(): winston.transport[] {
  const transports: winston.transport[] = [];

  // Console transport — always present, format differs by env
  if (!IS_TEST) {
    transports.push(
      new winston.transports.Console({
        format: IS_PROD ? jsonFormat : devFormat,
      }),
    );
  }

  // File transports — only when LOG_DIR is writable
  if (IS_PROD || process.env.LOG_TO_FILE === 'true') {
    try {
      if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

      // All levels combined
      transports.push(
        new winston.transports.File({
          filename:  path.join(LOG_DIR, 'combined.log'),
          format:    jsonFormat,
          maxsize:   20 * 1024 * 1024, // 20 MB
          maxFiles:  10,
          tailable:  true,
        }),
      );

      // Errors only — quick triage file
      transports.push(
        new winston.transports.File({
          filename:  path.join(LOG_DIR, 'error.log'),
          level:     'error',
          format:    jsonFormat,
          maxsize:   10 * 1024 * 1024,
          maxFiles:  5,
          tailable:  true,
        }),
      );

      // HTTP access log — separated for ingestion by log aggregators
      transports.push(
        new winston.transports.File({
          filename:  path.join(LOG_DIR, 'access.log'),
          level:     'http',
          format:    jsonFormat,
          maxsize:   50 * 1024 * 1024,
          maxFiles:  7,
          tailable:  true,
        }),
      );
    } catch (err) {
      // File transport failure must never crash the server
      process.stderr.write(`[logger] Cannot create log directory: ${(err as Error).message}\n`);
    }
  }

  return transports;
}

// ─── Logger instance ──────────────────────────────────────────────────────────

export const logger = winston.createLogger({
  levels:      LOG_LEVELS,
  level:       process.env.LOG_LEVEL ?? (IS_PROD ? 'info' : 'debug'),
  defaultMeta: { service: SERVICE_NAME },
  transports:  buildTransports(),
  // Prevent Winston from exiting on uncaught exceptions; server handles that
  exitOnError: false,
});

// ─── Child logger factory ─────────────────────────────────────────────────────

/**
 * Create a child logger that always appends a fixed context block.
 *
 * @example
 *   const log = createChildLogger({ module: 'AnalysisWorker', jobId });
 *   log.info('Processing started');
 */
export function createChildLogger(
  meta: Record<string, unknown>,
): winston.Logger {
  return logger.child(meta);
}

// ─── Convenience typed wrappers ───────────────────────────────────────────────

/**
 * Log an AI provider interaction — request params and response metrics.
 *
 * @example
 *   logAIRequest({ provider: 'OPENAI', model: 'gpt-4o', ... });
 */
export function logAIRequest(meta: {
  provider:     string;
  model:        string;
  analysisId?:  string;
  requirementId?: string;
  promptTokens?:  number;
  systemPromptLen: number;
  userPromptLen:   number;
  temperature?:    number;
}): void {
  logger.info('AI request dispatched', { category: 'ai', ...meta });
}

export function logAIResponse(meta: {
  provider:     string;
  model:        string;
  analysisId?:  string;
  durationMs:   number;
  tokensPrompt:     number;
  tokensCompletion: number;
  tokensTotal:      number;
  costUsd:          number | null;
  success:          boolean;
  errorMessage?:    string;
}): void {
  const level = meta.success ? 'info' : 'error';
  logger[level]('AI response received', { category: 'ai', ...meta });
}

/**
 * Log a performance metric — useful for slow query / slow job detection.
 */
export function logPerformance(meta: {
  operation:  string;
  durationMs: number;
  threshold?: number;  // warn threshold in ms
  context?:   Record<string, unknown>;
}): void {
  const { threshold = 2_000, durationMs, operation, context } = meta;
  const level = durationMs > threshold ? 'warn' : 'debug';
  logger[level]('Performance metric', {
    category:   'performance',
    operation,
    durationMs,
    slow:       durationMs > threshold,
    ...context,
  });
}
