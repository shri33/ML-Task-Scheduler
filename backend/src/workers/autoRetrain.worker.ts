/**
 * Auto-Retrain Worker
 * BullMQ repeating job that runs checkAndRetrain() on a configurable cron.
 *
 * Run as separate process: node dist/workers/autoRetrain.worker.js
 *
 * Environment:
 *   RETRAIN_CRON        - cron expression (default: "0 2 * * *" = 2 AM daily)
 *   RETRAIN_EVERY_MS    - alternative: interval in ms (overrides cron if set)
 *   REDIS_URL           - Redis connection string
 */

import { Worker, Queue, Job } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

import logger from '../lib/logger';
import { autoRetrainService } from '../services/autoRetrain.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'auto-retrain';

// Cron: default 2 AM UTC daily. Override via RETRAIN_CRON env var.
const RETRAIN_CRON = process.env.RETRAIN_CRON || '0 2 * * *';
// Alternative: run every N ms (useful for testing). Overrides cron if non-zero.
const RETRAIN_EVERY_MS = parseInt(process.env.RETRAIN_EVERY_MS || '0', 10);

function getRedisConnection() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

// ---------------------------------------------------------------------------
// Register the repeating job (idempotent — BullMQ deduplicates by jobId)
// ---------------------------------------------------------------------------
async function registerRepeatingJob(): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() });

  const repeatOpts = RETRAIN_EVERY_MS > 0
    ? { every: RETRAIN_EVERY_MS }
    : { pattern: RETRAIN_CRON };

  await queue.add(
    'check-and-retrain',
    {},
    {
      repeat: repeatOpts,
      jobId: 'auto-retrain-singleton', // deduplication key
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 }, // 1 min, 2 min, 4 min
      removeOnComplete: { age: 86400, count: 30 },     // keep 30 completed
      removeOnFail:    { age: 86400 * 7 },             // keep 7 days of failures
    },
  );

  logger.info('Auto-retrain repeating job registered', {
    schedule: RETRAIN_EVERY_MS > 0 ? `every ${RETRAIN_EVERY_MS}ms` : RETRAIN_CRON,
  });

  await queue.close();
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------
async function processRetrainJob(job: Job): Promise<Record<string, unknown>> {
  logger.info('Auto-retrain job started', { jobId: job.id });
  await job.updateProgress(10);

  const result = await autoRetrainService.checkAndRetrain();

  await job.updateProgress(100);

  logger.info('Auto-retrain job completed', { jobId: job.id, ...result });

  return result as unknown as Record<string, unknown>;
}

const worker = new Worker(
  QUEUE_NAME,
  processRetrainJob,
  {
    connection: getRedisConnection(),
    concurrency: 1, // never run two retrains simultaneously
  },
);

worker.on('completed', (job, result) => {
  logger.info('Auto-retrain job done', {
    jobId: job.id,
    triggered: result?.triggered,
    reason: result?.reason,
  });
});

worker.on('failed', (job, err) => {
  logger.error('Auto-retrain job failed', { jobId: job?.id, error: err.message });
});

worker.on('error', (err) => {
  logger.error('Auto-retrain worker error', err);
});

// Register repeating job then keep worker alive
registerRepeatingJob()
  .then(() => logger.info('Auto-retrain worker started', {
    schedule: RETRAIN_EVERY_MS > 0 ? `every ${RETRAIN_EVERY_MS}ms` : RETRAIN_CRON,
  }))
  .catch((err) => {
    logger.error('Failed to register auto-retrain job', err);
    process.exit(1);
  });

// Graceful shutdown
async function shutdown() {
  logger.info('Auto-retrain worker shutting down...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default worker;
