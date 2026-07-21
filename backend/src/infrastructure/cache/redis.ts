import { createClient } from 'redis';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';

export type RedisClient = ReturnType<typeof createClient>;
export type RedisClientType = RedisClient;

let _client: RedisClient | null = null;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message?.trim();
    if (message) return message;
    if (err.name) return err.name;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Returns (and lazily creates) the singleton Redis client.
 * We use the same client instance throughout the app lifetime.
 */
export function getRedisClient(): RedisClient {
  if (_client) return _client;

  _client = createClient({
    url: env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries >= 10) {
          logger.error('Redis max reconnection attempts reached');
          return new Error('Redis max reconnection attempts reached');
        }
        const delay = Math.min(retries * 100, 3_000);
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  });

  _client.on('error', (err) =>
    logger.error('Redis client error', { error: getErrorMessage(err) }),
  );
  _client.on('connect', () => logger.info('Redis client connected'));
  _client.on('reconnecting', () => logger.warn('Redis client reconnecting'));
  _client.on('ready', () => logger.info('Redis client ready'));

  return _client;
}

/**
 * Opens the Redis connection.
 * Called once at server start-up.
 */
export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  await client.connect();
  await client.ping();
  logger.info('Redis ping OK', { url: env.REDIS_URL });
}

/**
 * Gracefully closes the Redis connection.
 * Called from the shutdown handler in server.ts.
 */
export async function disconnectRedis(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
    logger.info('Redis connection closed');
  }
}

// Backward-compatible singleton used by existing route/service wiring.
export const redis = getRedisClient();
