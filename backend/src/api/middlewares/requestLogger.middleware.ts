import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../shared/logger';

// ─── Paths excluded from access logging ──────────────────────────────────────

const SILENT_PATHS = new Set(['/api/v1/health', '/health', '/favicon.ico']);

// ─── Sensitive header/body keys to redact ────────────────────────────────────

const REDACTED = '[REDACTED]';
const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'x-api-key', 'x-auth-token',
]);
const SENSITIVE_BODY_KEYS = new Set([
  'password', 'currentPassword', 'newPassword',
  'token', 'refreshToken', 'resetToken',
  'secret', 'apiKey', 'api_key',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function redactHeaders(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

function redactBody(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    out[key] = SENSITIVE_BODY_KEYS.has(key.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * requestLoggerMiddleware
 *
 * Responsibilities:
 *   1. Assigns a unique `x-request-id` to every request (forwarded or generated).
 *   2. Echoes the request-id back in the response header.
 *   3. Logs the inbound request at DEBUG level — method, path, query, sanitised body.
 *   4. Logs the outbound response at HTTP level — status, duration, content-length.
 *   5. Upgrades to WARN for 4xx, ERROR for 5xx.
 *   6. Skips access logging for silent paths (health-check, favicon).
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId =
    (req.headers['x-request-id'] as string | undefined) ?? uuidv4();

  // Propagate request-id throughout the lifecycle
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start    = process.hrtime.bigint();
  const isSilent = SILENT_PATHS.has(req.path);

  // ── Inbound request log (DEBUG) ──────────────────────────────────────────
  if (!isSilent) {
    logger.debug('Incoming request', {
      category:  'http',
      requestId,
      method:    req.method,
      path:      req.path,
      query:     req.query,
      headers:   redactHeaders(req.headers as Record<string, string | string[] | undefined>),
      body:      redactBody(req.body),
      ip:        req.ip,
      userId:    req.user?.sub,
    });
  }

  // ── Response finish hook ─────────────────────────────────────────────────
  res.on('finish', () => {
    if (isSilent) return;

    const durationMs     = Number(process.hrtime.bigint() - start) / 1_000_000;
    const { statusCode } = res;
    const contentLength  = res.getHeader('content-length');

    const level =
      statusCode >= 500 ? 'error' :
      statusCode >= 400 ? 'warn'  :
      'http';

    logger[level]('HTTP response', {
      category:    'http',
      requestId,
      method:      req.method,
      path:        req.path,
      statusCode,
      durationMs:  Math.round(durationMs * 100) / 100,
      contentLength: contentLength ?? undefined,
      userId:      req.user?.sub,
      ip:          req.ip,
      userAgent:   req.headers['user-agent'],
    });

    // Slow-request warning — threshold 3 s
    if (durationMs > 3_000) {
      logger.warn('Slow HTTP request detected', {
        category:  'performance',
        requestId,
        method:    req.method,
        path:      req.path,
        durationMs: Math.round(durationMs),
        threshold:  3_000,
      });
    }
  });

  next();
}

/** @deprecated Use requestLoggerMiddleware — kept for backwards compat. */
export const requestLogger = requestLoggerMiddleware;
