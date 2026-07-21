import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../../domain/errors/AppError';
import { logger } from '../../shared/logger';

// ─── Error context builder ────────────────────────────────────────────────────

function buildContext(req: Request) {
  return {
    requestId: req.headers['x-request-id'] as string | undefined,
    method:    req.method,
    path:      req.path,
    userId:    req.user?.sub,
    ip:        req.ip,
  };
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * errorHandlerMiddleware
 *
 * Centralized Express error handler — must be the LAST middleware in app.ts.
 *
 * Behaviour:
 *  • AppError (operational)  → logs WARN for 4xx, ERROR for 5xx; returns structured JSON.
 *  • ValidationError         → 422 with per-field `details` array.
 *  • Unexpected errors       → logs ERROR with full stack; returns generic 500.
 *  • Never leaks stack traces to the client.
 */
export function errorHandlerMiddleware(
  err:   Error,
  req:   Request,
  res:   Response,
  _next: NextFunction,
): void {
  const ctx = buildContext(req);

  // ── Operational errors (AppError subclasses) ──────────────────────────────
  if (err instanceof AppError) {
    const is5xx = err.statusCode >= 500;

    if (is5xx) {
      logger.error('Operational server error', {
        category:   'error',
        ...ctx,
        errorCode:  err.code,
        message:    err.message,
        stack:      err.stack,
      });
    } else {
      logger.warn('Client error', {
        category:   'error',
        ...ctx,
        errorCode:  err.code,
        message:    err.message,
        statusCode: err.statusCode,
      });
    }

    const body: Record<string, unknown> = {
      success: false,
      error: {
        code:    err.code,
        message: err.message,
      },
    };

    if (err instanceof ValidationError && err.details.length > 0) {
      (body.error as Record<string, unknown>).details = err.details;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // ── Unexpected / programmer errors ────────────────────────────────────────
  logger.error('Unhandled error', {
    category: 'error',
    ...ctx,
    name:     err.name,
    message:  err.message,
    stack:    err.stack,
  });

  res.status(500).json({
    success: false,
    error: {
      code:    'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  });
}

/** @deprecated Use errorHandlerMiddleware — kept for backwards compat. */
export const errorHandler = errorHandlerMiddleware;
