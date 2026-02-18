/**
 * Prediction Queue Producer
 * Enqueues ML prediction jobs for async processing
 */

import { Job, QueueEvents } from 'bullmq';
import { getPredictionQueue, getNotificationQueue, getRedisConnection } from './index';
import { PredictionJobData, PredictionJobResult, JOB_NAMES } from './types';
import logger from '../lib/logger';

// Lazy-initialized QueueEvents for waitUntilFinished
let predictionQueueEvents: QueueEvents | null = null;

function getPredictionQueueEvents(): QueueEvents {
  if (!predictionQueueEvents) {
    predictionQueueEvents = new QueueEvents('prediction', {
      connection: getRedisConnection(),
    });
  }
  return predictionQueueEvents;
}

/**
 * Enqueue a single prediction job
 * Returns job ID for tracking
 */
export async function enqueuePrediction(
  data: Omit<PredictionJobData, 'requestedAt'>
): Promise<{ jobId: string; position: number }> {
  const queue = getPredictionQueue();
  
  const jobData: PredictionJobData = {
    ...data,
    requestedAt: new Date().toISOString(),
  };

  const job = await queue.add(JOB_NAMES.PREDICT, jobData, {
    jobId: `pred-${data.taskId}-${Date.now()}`,
    priority: data.priority, // Higher priority tasks processed first
  });

  const position = await job.getState() === 'waiting' 
    ? await queue.getWaitingCount() 
    : 0;

  logger.debug('Prediction job enqueued', { 
    jobId: job.id, 
    taskId: data.taskId,
    position 
  });

  return { 
    jobId: job.id!, 
    position 
  };
}

/**
 * Enqueue batch predictions
 * More efficient for multiple tasks
 */
export async function enqueueBatchPredictions(
  tasks: Array<Omit<PredictionJobData, 'requestedAt'>>
): Promise<{ jobIds: string[]; count: number }> {
  const queue = getPredictionQueue();
  
  const jobs = tasks.map(task => ({
    name: JOB_NAMES.PREDICT,
    data: {
      ...task,
      requestedAt: new Date().toISOString(),
    } as PredictionJobData,
    opts: {
      jobId: `pred-${task.taskId}-${Date.now()}`,
      priority: task.priority,
    },
  }));

  const addedJobs = await queue.addBulk(jobs);
  
  logger.info('Batch predictions enqueued', { count: addedJobs.length });

  return {
    jobIds: addedJobs.map((j: { id?: string }) => j.id!),
    count: addedJobs.length,
  };
}

/**
 * Get prediction job status
 */
export async function getPredictionStatus(jobId: string): Promise<{
  id: string;
  state: string;
  progress: number;
  result?: PredictionJobResult;
  failedReason?: string;
} | null> {
  const queue = getPredictionQueue();
  const job = await queue.getJob(jobId);
  
  if (!job) return null;

  const state = await job.getState();
  
  return {
    id: job.id!,
    state,
    progress: job.progress as number || 0,
    result: state === 'completed' ? job.returnvalue : undefined,
    failedReason: state === 'failed' ? job.failedReason : undefined,
  };
}

/**
 * Wait for prediction result (with timeout)
 */
export async function waitForPrediction(
  jobId: string,
  timeoutMs: number = 30000
): Promise<PredictionJobResult | null> {
  const queue = getPredictionQueue();
  const job = await queue.getJob(jobId);
  
  if (!job) return null;

  try {
    const queueEvents = getPredictionQueueEvents();
    const result = await job.waitUntilFinished(
      queueEvents,
      timeoutMs
    );
    return result;
  } catch (error) {
    logger.warn('Prediction wait timeout', { jobId, timeoutMs });
    return null;
  }
}

/**
 * Cancel a pending prediction
 */
export async function cancelPrediction(jobId: string): Promise<boolean> {
  const queue = getPredictionQueue();
  const job = await queue.getJob(jobId);
  
  if (!job) return false;

  const state = await job.getState();
  if (state === 'waiting' || state === 'delayed') {
    await job.remove();
    logger.info('Prediction cancelled', { jobId });
    return true;
  }

  return false;
}

export default {
  enqueuePrediction,
  enqueueBatchPredictions,
  getPredictionStatus,
  waitForPrediction,
  cancelPrediction,
};
