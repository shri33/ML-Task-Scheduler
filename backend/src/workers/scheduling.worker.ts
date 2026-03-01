/**
 * Scheduling Worker
 * Processes fog computing scheduling jobs from the queue
 *
 * Run as separate process: node dist/workers/scheduling.worker.js
 */

import { Worker, Job } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

import { SchedulingJobData, SchedulingJobResult, JOB_NAMES } from '../queues/types';
import logger from '../lib/logger';
import {
  generateSampleDevices,
  generateSampleTasks,
  generateSampleFogNodes,
  HybridHeuristicScheduler,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  roundRobinSchedule,
  minMinSchedule,
} from '../services/fogComputing.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CONCURRENCY = parseInt(process.env.SCHEDULING_WORKER_CONCURRENCY || '2', 10);

function getRedisConnection() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

async function processScheduling(job: Job<SchedulingJobData>): Promise<SchedulingJobResult> {
  const startTime = Date.now();
  const { taskIds, algorithm, requestedBy } = job.data;
  const taskCount = taskIds.length || 50;

  logger.info('Processing scheduling job', { jobId: job.id, algorithm, taskCount });
  await job.updateProgress(10);

  // Generate test data
  const devices = generateSampleDevices(Math.min(taskCount, 20));
  const tasks = generateSampleTasks(taskCount, devices);
  const fogNodes = generateSampleFogNodes(10);

  await job.updateProgress(30);

  let result;
  switch (algorithm) {
    case 'hybrid': {
      const scheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
      result = scheduler.schedule();
      break;
    }
    case 'ipso':
      result = ipsoOnlySchedule(tasks, fogNodes, devices);
      break;
    case 'iaco':
      result = iacoOnlySchedule(tasks, fogNodes, devices);
      break;
    case 'round-robin':
      result = roundRobinSchedule(tasks, fogNodes, devices);
      break;
    case 'min-min':
      result = minMinSchedule(tasks, fogNodes, devices);
      break;
    default:
      result = { totalDelay: 0, totalEnergy: 0, allocations: new Map<string, string>(), reliability: 0 };
  }

  await job.updateProgress(90);

  const latencyMs = Date.now() - startTime;
  logger.info('Scheduling job completed', { jobId: job.id, algorithm, latencyMs });

  // Convert Map<string, string> allocations to array format
  const allocationEntries: Array<{ taskId: string; fogNodeId: string }> = [];
  if (result.allocations instanceof Map) {
    result.allocations.forEach((fogNodeId: string, taskId: string) => {
      allocationEntries.push({ taskId, fogNodeId });
    });
  }

  return {
    allocations: allocationEntries,
    totalDelay: result.totalDelay,
    totalEnergy: result.totalEnergy,
    reliability: result.reliability || 0,
    processedAt: new Date().toISOString(),
    latencyMs,
  };
}

// Create worker
const schedulingWorker = new Worker<SchedulingJobData, SchedulingJobResult>(
  'task-scheduling',
  processScheduling,
  {
    connection: getRedisConnection(),
    concurrency: CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

schedulingWorker.on('completed', (job, result) => {
  logger.info('Scheduling job completed', { jobId: job.id, latency: result.latencyMs });
});

schedulingWorker.on('failed', (job, err) => {
  logger.error('Scheduling job failed', { jobId: job?.id, error: err.message });
});

schedulingWorker.on('error', (err) => {
  logger.error('Scheduling worker error', err);
});

logger.info(`Scheduling worker started with concurrency ${CONCURRENCY}`);

// Graceful shutdown
async function shutdown() {
  logger.info('Scheduling worker shutting down...');
  await schedulingWorker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default schedulingWorker;
