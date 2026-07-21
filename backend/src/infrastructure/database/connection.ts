import { Pool, PoolConfig } from 'pg';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';

const poolConfig: PoolConfig = {
  connectionString:    env.DATABASE_URL,
  max:                 20,
  idleTimeoutMillis:   30_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle:     false,
};

export const db = new Pool(poolConfig);

db.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message, stack: err.stack });
});

db.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

/**
 * Verify the pool can reach the database.
 * Called once at server start-up — exits if the DB is unreachable.
 */
export async function connectDatabase(): Promise<void> {
  const client = await db.connect();
  try {
    const { rows } = await client.query('SELECT current_database() AS db, version()');
    logger.info('PostgreSQL connected', {
      database: rows[0].db,
      version:  rows[0].version.split(' ').slice(0, 2).join(' '),
    });
  } finally {
    client.release();
  }
}

/**
 * Gracefully drain the pool.
 * Called from the shutdown handler in server.ts.
 */
export async function disconnectDatabase(): Promise<void> {
  await db.end();
  logger.info('PostgreSQL pool closed');
}

/**
 * Run a callback inside a serializable transaction.
 * Rolls back automatically on error.
 */
export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
