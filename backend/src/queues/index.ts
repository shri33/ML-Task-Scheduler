/**
 * BullMQ Queue Configuration
 * Centralized queue setup for async job processing
 */

import { Queue, QueueOptions } from 'bullmq';
import { getEnv } from '../lib/env';
import logger from '../lib/logger';

// Queue connection options
export function getRedisConnection() {
  const env = getEnv();
  const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
  
  // Parse Redis URL
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
  };
}

// Default queue options
const defaultOptions: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400 * 7, // Keep failed jobs for 7 days (for DLQ inspection)
    },
  },
};

// Queue instances (singleton pattern)
let predictionQueue: Queue | null = null;
let schedulingQueue: Queue | null = null;
let notificationQueue: Queue | null = null;
let deadLetterQueue: Queue | null = null;

/**
 * Get or create the prediction queue
 */
export function getPredictionQueue(): Queue {
  if (!predictionQueue) {
    predictionQueue = new Queue('prediction', {
      connection: getRedisConnection(),
      ...defaultOptions,
    });
    logger.info('Prediction queue initialized');
  }
  return predictionQueue;
}

/**
 * Get or create the scheduling queue
 */
export function getSchedulingQueue(): Queue {
  if (!schedulingQueue) {
    schedulingQueue = new Queue('task-scheduling', {
      connection: getRedisConnection(),
      ...defaultOptions,
    });
    logger.info('Scheduling queue initialized');
  }
  return schedulingQueue;
}

/**
 * Get or create the notification queue
 */
export function getNotificationQueue(): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue('notifications', {
      connection: getRedisConnection(),
      ...defaultOptions,
      defaultJobOptions: {
        ...defaultOptions.defaultJobOptions,
        attempts: 5, // More retries for notifications
      },
    });
    logger.info('Notification queue initialized');
  }
  return notificationQueue;
}

/**
 * Get or create the dead-letter queue (DLQ)
 * Jobs that exhaust all retries in any queue are moved here
 * for manual inspection, replay, or alerting.
 */
export function getDeadLetterQueue(): Queue {
  if (!deadLetterQueue) {
    deadLetterQueue = new Queue('dead-letter', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: false,  // Keep all DLQ jobs for inspection
        removeOnFail: false,
      },
    });
    logger.info('Dead-letter queue initialized');
  }
  return deadLetterQueue;
}

/**
 * Move a permanently failed job to the dead-letter queue.
 * Call this from queue workers when a job exhausts all retries.
 */
export async function moveToDeadLetter(
  sourceQueue: string,
  jobId: string,
  jobData: Record<string, unknown>,
  failedReason: string
): Promise<void> {
  const dlq = getDeadLetterQueue();
  await dlq.add('dead-letter-job', {
    originalQueue: sourceQueue,
    originalJobId: jobId,
    data: jobData,
    failedReason,
    movedAt: new Date().toISOString(),
  });
  logger.warn(`Job ${jobId} moved to dead-letter queue from ${sourceQueue}: ${failedReason}`);
}

/**
 * Close all queue connections gracefully
 */
export async function closeAllQueues(): Promise<void> {
  const queues = [predictionQueue, schedulingQueue, notificationQueue, deadLetterQueue];
  
  await Promise.all(
    queues
      .filter((q): q is Queue => q !== null)
      .map(q => q.close())
  );
  
  predictionQueue = null;
  schedulingQueue = null;
  notificationQueue = null;
  deadLetterQueue = null;
  
  logger.info('All queues closed');
}

/**
 * Get queue health status
 */
export async function getQueueHealth(): Promise<{
  prediction: { waiting: number; active: number; failed: number };
  scheduling: { waiting: number; active: number; failed: number };
  notification: { waiting: number; active: number; failed: number };
  deadLetter: { waiting: number; active: number; failed: number };
}> {
  const getStats = async (queue: Queue) => {
    const [waiting, active, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
    ]);
    return { waiting, active, failed };
  };

  return {
    prediction: await getStats(getPredictionQueue()),
    scheduling: await getStats(getSchedulingQueue()),
    notification: await getStats(getNotificationQueue()),
    deadLetter: await getStats(getDeadLetterQueue()),
  };
}

export default {
  getPredictionQueue,
  getSchedulingQueue,
  getNotificationQueue,
  getDeadLetterQueue,
  moveToDeadLetter,
  closeAllQueues,
  getQueueHealth,
};

