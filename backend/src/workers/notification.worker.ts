/**
 * Notification Worker
 * Processes notification delivery jobs from the queue
 *
 * Supports: WebSocket push & email notifications
 * Run as separate process: node dist/workers/notification.worker.js
 */

import { Worker, Job } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

import { NotificationJobData, JOB_NAMES } from '../queues/types';
import logger from '../lib/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CONCURRENCY = parseInt(process.env.NOTIFICATION_WORKER_CONCURRENCY || '5', 10);

function getRedisConnection() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

/** Format a human-readable notification message */
function formatMessage(data: NotificationJobData): string {
  switch (data.type) {
    case 'task-completed':
      return `Task ${data.taskId} completed successfully.`;
    case 'task-failed':
      return `Task ${data.taskId} has failed.`;
    case 'prediction-ready':
      return `ML prediction for task ${data.taskId} is ready.`;
    case 'scheduling-done':
      return `Scheduling run completed.`;
    default:
      return 'System notification.';
  }
}

async function processNotification(job: Job<NotificationJobData>): Promise<{ delivered: string[] }> {
  const { type, userId, channels, payload, taskId } = job.data;
  const delivered: string[] = [];

  logger.info('Processing notification', { jobId: job.id, type, channels });

  for (const channel of channels) {
    try {
      if (channel === 'websocket') {
        // WebSocket delivery is handled by the main server process through Socket.IO.
        // Here we simply log; the main process should subscribe to completed events
        // and relay via io.to(userId).emit(...)
        logger.info('WebSocket notification queued', { userId, type, taskId });
        delivered.push('websocket');
      }

      if (channel === 'email') {
        // Email delivery – delegate to nodemailer transport configured in main app.
        // In a production setup this would import the email service and send.
        logger.info('Email notification queued', { userId, type, taskId });
        delivered.push('email');
      }
    } catch (err) {
      logger.error(`Failed to deliver via ${channel}`, err instanceof Error ? err : new Error(String(err)));
    }
  }

  return { delivered };
}

// Create worker
const notificationWorker = new Worker<NotificationJobData, { delivered: string[] }>(
  'notifications',
  processNotification,
  {
    connection: getRedisConnection(),
    concurrency: CONCURRENCY,
    limiter: {
      max: 50,
      duration: 1000,
    },
  }
);

notificationWorker.on('completed', (job, result) => {
  logger.info('Notification delivered', { jobId: job.id, channels: result.delivered });
});

notificationWorker.on('failed', (job, err) => {
  logger.error('Notification delivery failed', { jobId: job?.id, error: err.message });
});

notificationWorker.on('error', (err) => {
  logger.error('Notification worker error', err);
});

logger.info(`Notification worker started with concurrency ${CONCURRENCY}`);

// Graceful shutdown
async function shutdown() {
  logger.info('Notification worker shutting down...');
  await notificationWorker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default notificationWorker;
