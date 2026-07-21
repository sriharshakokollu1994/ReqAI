import Bull from 'bull';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';

export const ANALYSIS_QUEUE_NAME = 'analysis';

type QueueLike = Pick<Bull.Queue, 'add'>;

let analysisQueue: Bull.Queue | null = null;

/**
 * Singleton Bull queue for AI analysis jobs.
 *
 * Settings:
 *  - removeOnComplete: keep last 200 completed jobs for audit/debug
 *  - removeOnFail:     keep last 500 failed jobs for inspection
 *  - defaultJobOptions:
 *      attempts    – 3 automatic retries
 *      backoff     – exponential starting at 5 s
 *      timeout     – 5 min hard cap per job
 */
function createQueue(): Bull.Queue {
  const q = new Bull(ANALYSIS_QUEUE_NAME, {
    redis: env.REDIS_URL,
    defaultJobOptions: {
      attempts:         3,
      backoff:          { type: 'exponential', delay: 5_000 },
      timeout:          5 * 60 * 1_000,   // 5 min
      removeOnComplete: 200,
      removeOnFail:     500,
    },
  });

  q.on('error', (err) =>
    logger.error('Bull queue error', {
      queue: ANALYSIS_QUEUE_NAME,
      error: err instanceof Error ? err.message : String(err),
    }),
  );

  q.on('waiting', (jobId) =>
    logger.debug('Job waiting', { queue: ANALYSIS_QUEUE_NAME, jobId }),
  );

  q.on('active', (job) =>
    logger.info('Job started', { queue: ANALYSIS_QUEUE_NAME, jobId: job.id, data: job.data }),
  );

  q.on('completed', (job) =>
    logger.info('Job completed', { queue: ANALYSIS_QUEUE_NAME, jobId: job.id }),
  );

  q.on('failed', (job, err) =>
    logger.error('Job failed', {
      queue:      ANALYSIS_QUEUE_NAME,
      jobId:      job.id,
      attempt:    job.attemptsMade,
      error:      err.message,
    }),
  );

  q.on('stalled', (job) =>
    logger.warn('Job stalled', { queue: ANALYSIS_QUEUE_NAME, jobId: job.id }),
  );

  return q;
}

export function initializeAnalysisQueue(): Bull.Queue {
  if (!analysisQueue) {
    analysisQueue = createQueue();
  }
  return analysisQueue;
}

function queueUnavailableError(): Error {
  return new Error('Analysis queue is unavailable because Redis is not connected');
}

// Backward-compatible route/service dependency that exposes `add`.
export const queue: QueueLike = {
  add(name: string, data?: unknown, opts?: Bull.JobOptions) {
    if (!analysisQueue) {
      return Promise.reject(queueUnavailableError()) as any;
    }
    return analysisQueue.add(name, data as any, opts);
  },
};

/**
 * Gracefully shuts down the queue (drains in-flight jobs then closes connections).
 */
export async function shutdownQueue(): Promise<void> {
  if (!analysisQueue) return;

  await analysisQueue.close();
  analysisQueue = null;
  logger.info('Analysis queue closed');
}
