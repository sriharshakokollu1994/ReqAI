import { Request, Response } from 'express';
import { Pool } from 'pg';
import { RedisClientType } from '../../infrastructure/cache/redis';
import { logger } from '../../shared/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus = 'ok' | 'fail';
type OverallStatus = 'ok' | 'degraded' | 'down';

interface CheckResult {
  status:     ServiceStatus;
  latencyMs?: number;
  message?:   string;
}

interface HealthPayload {
  status:    OverallStatus;
  uptime:    number;       // seconds the process has been running
  timestamp: string;       // ISO 8601
  version:   string;       // from package.json
  checks:    Record<string, CheckResult>;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class HealthController {
  constructor(
    private readonly db:    Pool,
    private readonly redis: RedisClientType,
  ) {}

  // ── GET /health — full dependency check ────────────────────────────────────

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [Health]
   *     summary: Full health check — API + database + cache
   *     description: >
   *       Probes all downstream dependencies.
   *       Returns 200 when all pass, 503 when any critical dependency is down.
   *     responses:
   *       200: { description: All systems operational }
   *       503: { description: One or more services unavailable }
   */
  check = async (_req: Request, res: Response): Promise<void> => {
    const checks: Record<string, CheckResult> = {};
    let overall: OverallStatus = 'ok';

    // ── PostgreSQL ─────────────────────────────────────────────────────────
    const dbStart = process.hrtime.bigint();
    try {
      await this.db.query('SELECT 1');
      checks['database'] = {
        status:    'ok',
        latencyMs: Math.round(Number(process.hrtime.bigint() - dbStart) / 1_000_000),
      };
    } catch (err: any) {
      checks['database'] = { status: 'fail', message: 'PostgreSQL unreachable' };
      overall = 'down';
      logger.error('Health check: database down', { error: err.message });
    }

    // ── Redis ──────────────────────────────────────────────────────────────
    const redisStart = process.hrtime.bigint();
    try {
      await this.redis.ping();
      checks['redis'] = {
        status:    'ok',
        latencyMs: Math.round(Number(process.hrtime.bigint() - redisStart) / 1_000_000),
      };
    } catch (err: any) {
      checks['redis'] = { status: 'fail', message: 'Redis unreachable' };
      // Redis failure is degraded (app can still serve cached reads)
      if (overall === 'ok') overall = 'degraded';
      logger.warn('Health check: Redis degraded', { error: err.message });
    }

    const payload: HealthPayload = {
      status:    overall,
      uptime:    Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version:   process.env['npm_package_version'] ?? '1.0.0',
      checks,
    };

    const httpStatus = overall === 'down' ? 503 : 200;
    res.status(httpStatus).json({ success: httpStatus === 200, data: payload });
  };

  // ── GET /health/live — liveness probe ──────────────────────────────────────

  /**
   * @openapi
   * /health/live:
   *   get:
   *     tags: [Health]
   *     summary: Liveness probe — is the Node.js process alive?
   *     description: >
   *       Used by Docker HEALTHCHECK and Kubernetes livenessProbe.
   *       Returns 200 immediately — no external calls made.
   *     responses:
   *       200: { description: Process is alive }
   */
  live = (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok', uptime: Math.floor(process.uptime()) });
  };

  // ── GET /health/ready — readiness probe ────────────────────────────────────

  /**
   * @openapi
   * /health/ready:
   *   get:
   *     tags: [Health]
   *     summary: Readiness probe — is the app ready to accept traffic?
   *     description: >
   *       Used by Kubernetes readinessProbe and Docker depends_on health gates.
   *       Checks database connectivity (minimum requirement for serving requests).
   *     responses:
   *       200: { description: App is ready to serve traffic }
   *       503: { description: App not ready (database unavailable) }
   */
  ready = async (_req: Request, res: Response): Promise<void> => {
    try {
      await this.db.query('SELECT 1');
      res.status(200).json({
        status:  'ready',
        uptime:  Math.floor(process.uptime()),
        version: process.env['npm_package_version'] ?? '1.0.0',
      });
    } catch (err: any) {
      logger.warn('Readiness probe failed — database unavailable', { error: err.message });
      res.status(503).json({
        status:  'not_ready',
        reason:  'Database unavailable',
      });
    }
  };
}
