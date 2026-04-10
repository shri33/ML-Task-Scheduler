/**
 * Scheduling Worker
 * Processes both fog computing scheduling jobs AND user-task scheduling jobs.
 *
 * Run as separate process: node dist/workers/scheduling.worker.js
 */

import { Worker, Job } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

import { SchedulingJobData, SchedulingJobResult, TaskEventJobData, TaskEventJobResult, JOB_NAMES } from '../queues/types';
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
import { schedulerService, SchedulingAlgorithm } from '../services/scheduler.service';

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

// ---------------------------------------------------------------------------
// Fog computing scheduling (original)
// ---------------------------------------------------------------------------
async function processFogScheduling(job: Job<SchedulingJobData>): Promise<SchedulingJobResult> {
  const startTime = Date.now();
  const { taskIds, algorithm, requestedBy } = job.data;
  const taskCount = taskIds.length || 50;

  logger.info('Processing fog scheduling job', { jobId: job.id, algorithm, taskCount });
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
  logger.info('Fog scheduling job completed', { jobId: job.id, algorithm, latencyMs });

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

// ---------------------------------------------------------------------------
// User-task scheduling (new: event-driven via scheduler service)
// ---------------------------------------------------------------------------
async function processUserTaskScheduling(job: Job<SchedulingJobData>): Promise<SchedulingJobResult> {
  const startTime = Date.now();
  const { taskIds, algorithm } = job.data;

  logger.info('Processing user-task scheduling job', { jobId: job.id, algorithm, taskCount: taskIds.length });
  await job.updateProgress(10);

  // Map queue algorithm names to SchedulingAlgorithm type
  const algoMap: Record<string, SchedulingAlgorithm> = {
    'ml_enhanced': 'ml_enhanced',
    'hybrid_heuristic': 'hybrid_heuristic',
    'hybrid': 'hybrid_heuristic',
    'ipso': 'ipso',
    'iaco': 'iaco',
    'round-robin': 'round_robin',
    'round_robin': 'round_robin',
    'min-min': 'min_min',
    'min_min': 'min_min',
    'fcfs': 'fcfs',
    'edf': 'edf',
    'sjf': 'sjf',
  };

  const schedulingAlgorithm = algoMap[algorithm] || 'ml_enhanced';

  await job.updateProgress(30);

  const results = await schedulerService.schedule(
    taskIds.length > 0 ? taskIds : undefined,
    schedulingAlgorithm
  );

  await job.updateProgress(90);

  const latencyMs = Date.now() - startTime;
  logger.info('User-task scheduling completed', {
    jobId: job.id,
    algorithm: schedulingAlgorithm,
    tasksScheduled: results.length,
    latencyMs,
  });

  return {
    allocations: results.map(r => ({ taskId: r.taskId, fogNodeId: r.resourceId })),
    totalDelay: 0,
    totalEnergy: 0,
    reliability: results.length > 0
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100
      : 0,
    processedAt: new Date().toISOString(),
    latencyMs,
  };
}

// ---------------------------------------------------------------------------
// Task event handler (triggered by task CRUD)
// ---------------------------------------------------------------------------
async function processTaskEvent(job: Job<TaskEventJobData>): Promise<TaskEventJobResult> {
  const startTime = Date.now();
  const { eventType, taskId, algorithm } = job.data;

  logger.info('Processing task event', { jobId: job.id, eventType, taskId });

  // On task create/update: re-schedule pending tasks
  // On task delete/complete: no action needed (schedule is stale-tolerant)
  let scheduledTasks = 0;
  const usedAlgorithm = (algorithm as SchedulingAlgorithm) || 'ml_enhanced';

  if (eventType === 'task_created' || eventType === 'task_updated') {
    try {
      const results = await schedulerService.schedule(undefined, usedAlgorithm);
      scheduledTasks = results.length;
    } catch (err) {
      logger.warn('Task event scheduling failed (non-critical)', { error: String(err) });
    }
  }

  return {
    eventType,
    scheduledTasks,
    algorithm: usedAlgorithm,
    processedAt: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Unified worker — routes jobs by name
// ---------------------------------------------------------------------------
async function processJob(job: Job): Promise<any> {
  switch (job.name) {
    case JOB_NAMES.SCHEDULE_USER_TASKS:
      return processUserTaskScheduling(job as Job<SchedulingJobData>);
    case JOB_NAMES.TASK_EVENT:
      return processTaskEvent(job as Job<TaskEventJobData>);
    default:
      return processFogScheduling(job as Job<SchedulingJobData>);
  }
}

// Create worker
const schedulingWorker = new Worker(
  'task-scheduling',
  processJob,
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
  logger.info('Scheduling job completed', { jobId: job.id, name: job.name, latency: result?.latencyMs });
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
