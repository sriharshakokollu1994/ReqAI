import { Request, Response, NextFunction } from 'express';
import { logPerformance } from '../../shared/logger';

// ─── Thresholds (ms) ──────────────────────────────────────────────────────────

const THRESHOLDS: Record<string, number> = {
  default: 2_000,
  '/api/v1/projects':    1_000,
  '/api/v1/requirements': 1_500,
  '/api/v1/analyze':      10_000, // AI analysis is expected to be slow
  '/api/v1/export':       5_000,
  '/api/v1/admin':        1_000,
};

function resolveThreshold(path: string): number {
  for (const [prefix, ms] of Object.entries(THRESHOLDS)) {
    if (path.startsWith(prefix)) return ms;
  }
  return THRESHOLDS.default!;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * performanceLoggerMiddleware
 *
 * Measures wall-clock time for every request and emits a structured
 * performance log entry via `logPerformance()`.
 *
 * - Uses `process.hrtime.bigint()` for nanosecond precision.
 * - Logs at DEBUG for fast requests, WARN for slow requests (threshold varies by path).
 * - Attaches per-path threshold config so that AI/export paths are not flagged as slow.
 *
 * Register AFTER requestLoggerMiddleware but BEFORE route handlers.
 */
export function performanceLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start     = process.hrtime.bigint();
  const threshold = resolveThreshold(req.path);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    logPerformance({
      operation:  `${req.method} ${req.route?.path ?? req.path}`,
      durationMs: Math.round(durationMs * 100) / 100,
      threshold,
      context: {
        requestId:  req.headers['x-request-id'] as string | undefined,
        statusCode: res.statusCode,
        userId:     req.user?.sub,
      },
    });
  });

  next();
}
