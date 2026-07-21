import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import path from 'path';
import fs from 'fs';

import { env } from './config/env';
import { logger } from './shared/logger';
import { requestLoggerMiddleware }     from './api/middlewares/requestLogger.middleware';
import { performanceLoggerMiddleware } from './api/middlewares/performanceLogger.middleware';
import { errorHandlerMiddleware }      from './api/middlewares/errorHandler.middleware';
import apiRoutes from './api/routes/index';

export function createApp(): Application {
  const app = express();

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin:      env.FRONTEND_URL,
      credentials: true,
      methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }),
  );

  // ── Compression ─────────────────────────────────────────────────────────────
  app.use(compression());

  // ── Body parsers ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Cookie parser ───────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── Request logger (before routes, after body parse) ────────────────────────
  app.use(requestLoggerMiddleware);

  // ── Performance logger (after request logger, before routes) ────────────────
  app.use(performanceLoggerMiddleware);

  // ── Global rate limiter ─────────────────────────────────────────────────────
  app.use(
    '/api/',
    rateLimit({
      windowMs:         env.RATE_LIMIT_WINDOW_MS,
      max:              env.RATE_LIMIT_MAX,
      standardHeaders:  true,
      legacyHeaders:    false,
      message:          { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    }),
  );

  // ── OpenAPI / Swagger UI ────────────────────────────────────────────────────
  try {
    const specPath = path.join(__dirname, 'openapi', 'openapi.yaml');
    if (fs.existsSync(specPath)) {
      const spec = yaml.load(fs.readFileSync(specPath, 'utf8')) as Record<string, unknown>;
      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, {
        customSiteTitle: 'ReqAI API Docs',
        customCss: '.swagger-ui .topbar { display: none }',
      }));
      logger.info('OpenAPI UI available at /api/docs');
    }
  } catch (err: any) {
    logger.warn('Could not load OpenAPI spec', { error: err.message });
  }

  // ── API routes ──────────────────────────────────────────────────────────────
  app.use('/api/v1', apiRoutes);

  // ── 404 fallthrough ─────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error:   { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // ── Centralized error handler (must be last) ─────────────────────────────────
  app.use(errorHandlerMiddleware);

  return app;
}
