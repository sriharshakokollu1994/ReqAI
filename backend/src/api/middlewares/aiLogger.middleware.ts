import { Request, Response, NextFunction } from 'express';
import { logAIRequest, logAIResponse, logger } from '../../shared/logger';

// ─── Request augmentation ─────────────────────────────────────────────────────

// Extend Express Request to carry the AI timing start marker
declare global {
  namespace Express {
    interface Request {
      _aiStart?: bigint;
    }
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * aiLoggerMiddleware
 *
 * Attaches timing state to requests that hit AI analysis routes and logs
 * a structured AI activity record on response finish.
 *
 * Mount only on routes that trigger AI completions, e.g.:
 *   router.post('/analyze', aiLoggerMiddleware, authenticate, controller.analyze);
 *
 * Structured log fields:
 *   category: 'ai'
 *   route:    matched route path
 *   method:   HTTP verb
 *   userId:   id of requesting user
 *   durationMs: wall-clock time for the full request
 *   statusCode: HTTP response status
 */
export function aiLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  req._aiStart = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = req._aiStart
      ? Number(process.hrtime.bigint() - req._aiStart) / 1_000_000
      : -1;

    logger.info('AI route completed', {
      category:   'ai',
      requestId:  req.headers['x-request-id'] as string | undefined,
      method:     req.method,
      route:      req.route?.path ?? req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId:     req.user?.sub,
      success:    res.statusCode < 400,
    });
  });

  next();
}

// ─── Re-export convenience wrappers for provider adapters ─────────────────────

export { logAIRequest, logAIResponse };
