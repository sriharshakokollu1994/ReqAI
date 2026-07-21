import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/connection';
import { connectRedis, disconnectRedis } from './infrastructure/cache/redis';
import { initializeAnalysisQueue, shutdownQueue } from './infrastructure/queue/queue';
import { registerAnalysisWorker } from './infrastructure/queue/analysis.worker';
import { getEmailService } from './infrastructure/notifications/email.service';
import { env } from './config/env';
import { logger } from './shared/logger';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function bootstrap(): Promise<void> {
  logger.info('ReqAI backend starting', { nodeEnv: env.NODE_ENV, pid: process.pid });

  // ── Infrastructure connections ───────────────────────────────────────────────
  await connectDatabase();

  let redisReady = false;
  try {
    await connectRedis();
    redisReady = true;

    // Register Bull worker only when Redis-backed queue is available.
    registerAnalysisWorker(initializeAnalysisQueue());
  } catch (err) {
    logger.warn('Redis unavailable at startup; queue-backed features are temporarily disabled', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Email service (non-fatal — app runs without SMTP) ───────────────────────
  const emailService = getEmailService();
  const smtpReady    = await emailService.verifyConnection().catch(() => false);
  if (!smtpReady) {
    logger.warn('EmailService: SMTP not available — transactional emails disabled');
  }

  // ── Start HTTP server ────────────────────────────────────────────────────────
  const app    = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info('HTTP server listening', {
      port:    env.PORT,
      env:     env.NODE_ENV,
      docsUrl: `http://localhost:${env.PORT}/api/docs`,
    });
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    logger.warn(`${signal} received — starting graceful shutdown`);

    const timer = setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      // 1. Stop accepting new HTTP connections
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');

      // 2. Drain & close the queue (waits for active jobs to finish)
      if (redisReady) {
        await shutdownQueue();
      }

      // 3. Close Redis
      if (redisReady) {
        await disconnectRedis();
      }

      // 4. Close DB pool
      await disconnectDatabase();

      clearTimeout(timer);
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err: any) {
      logger.error('Error during shutdown', { error: err.message });
      clearTimeout(timer);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // ── Unhandled rejections / exceptions ───────────────────────────────────────
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack:  reason instanceof Error ? reason.stack   : undefined,
    });
    // Do NOT exit — let the server stay alive for operational stability
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — shutting down', { error: err.message, stack: err.stack });
    shutdown('UNCAUGHT_EXCEPTION');
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
