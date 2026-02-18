/**
 * Prediction Worker
 * Processes ML prediction jobs from the queue
 * 
 * Run as separate process: node dist/workers/prediction.worker.js
 */

import { Worker, Job } from 'bullmq';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

import { PredictionJobData, PredictionJobResult, JOB_NAMES } from '../queues/types';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { errorRecovery } from '../services/errorRecovery.service';

// Configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse Redis connection
function getRedisConnection() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

// Map enums to numbers for ML model
const sizeMap: Record<string, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
const typeMap: Record<string, number> = { CPU: 1, IO: 2, MIXED: 3 };

/**
 * Process a prediction job
 */
async function processPrediction(job: Job<PredictionJobData>): Promise<PredictionJobResult> {
  const startTime = Date.now();
  const { taskId, taskSize, taskType, priority, resourceLoad } = job.data;

  logger.info('Processing prediction job', { jobId: job.id, taskId });

  // Update progress
  await job.updateProgress(10);

  // Check circuit breaker
  if (!errorRecovery.isServiceAvailable('ml-service')) {
    logger.warn('ML service circuit breaker open, using fallback');
    return fallbackPrediction(job.data, startTime);
  }

  try {
    // Call ML service
    await job.updateProgress(30);
    
    const response = await axios.post(
      `${ML_SERVICE_URL}/api/predict`,
      {
        taskSize: sizeMap[taskSize] || 2,
        taskType: typeMap[taskType] || 1,
        priority,
        resourceLoad,
      },
      { timeout: 10000 }
    );

    await job.updateProgress(70);

    // Record success
    errorRecovery.recordSuccess('ml-service');

    const result: PredictionJobResult = {
      taskId,
      predictedTime: response.data.predictedTime,
      confidence: response.data.confidence,
      modelVersion: response.data.modelVersion,
      processedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };

    // Save prediction to database
    await job.updateProgress(90);
    await savePredictionToDb(result, job.data);

    logger.info('Prediction completed', { 
      jobId: job.id, 
      taskId, 
      latencyMs: result.latencyMs 
    });

    await job.updateProgress(100);
    return result;

  } catch (error) {
    // Record failure
    errorRecovery.recordFailure(
      'ml-service', 
      error instanceof Error ? error : new Error(String(error))
    );
    
    logger.warn('ML service call failed, using fallback', { 
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error)
    });

    return fallbackPrediction(job.data, startTime);
  }
}

/**
 * Fallback prediction when ML service unavailable
 */
function fallbackPrediction(data: PredictionJobData, startTime: number): PredictionJobResult {
  const { taskId, taskSize, taskType, priority, resourceLoad } = data;
  
  // Simple heuristic-based prediction
  const sizeWeight = sizeMap[taskSize] || 2;
  const typeWeight = taskType === 'IO' ? 1.5 : taskType === 'MIXED' ? 1.2 : 1;
  const loadFactor = 1 + (resourceLoad / 100);
  
  const baseTime = 2;
  const predictedTime = baseTime * sizeWeight * typeWeight * loadFactor;

  return {
    taskId,
    predictedTime: Math.round(predictedTime * 100) / 100,
    confidence: 0.65,
    modelVersion: 'fallback-v1',
    processedAt: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Save prediction to database
 */
async function savePredictionToDb(
  result: PredictionJobResult, 
  jobData: PredictionJobData
): Promise<void> {
  try {
    await prisma.prediction.create({
      data: {
        taskId: result.taskId,
        predictedTime: result.predictedTime,
        confidence: result.confidence,
        modelVersion: result.modelVersion,
        features: {
          taskSize: jobData.taskSize,
          taskType: jobData.taskType,
          priority: jobData.priority,
          resourceLoad: jobData.resourceLoad,
        },
      },
    });

    // Update task with prediction
    await prisma.task.update({
      where: { id: result.taskId },
      data: { predictedTime: result.predictedTime },
    });
  } catch (error) {
    logger.error('Failed to save prediction to DB', 
      error instanceof Error ? error : new Error(String(error))
    );
    // Don't throw - prediction was successful, just DB save failed
  }
}

/**
 * Start the worker
 */
function startWorker(): Worker {
  const worker = new Worker(
    'ml-prediction',
    processPrediction,
    {
      connection: getRedisConnection(),
      concurrency: CONCURRENCY,
      limiter: {
        max: 100,
        duration: 1000, // Max 100 jobs per second
      },
    }
  );

  // Event handlers
  worker.on('completed', (job: Job | undefined, result: PredictionJobResult) => {
    logger.debug('Job completed', { 
      jobId: job?.id, 
      taskId: result.taskId,
      latencyMs: result.latencyMs 
    });
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    logger.error('Job failed', error, { jobId: job?.id });
  });

  worker.on('error', (error: Error) => {
    logger.error('Worker error', error);
  });

  worker.on('ready', () => {
    logger.info('Prediction worker ready', { concurrency: CONCURRENCY });
  });

  return worker;
}

// Graceful shutdown
let worker: Worker | null = null;

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down worker`);
  
  if (worker) {
    await worker.close();
    logger.info('Worker closed');
  }
  
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start worker if run directly
if (require.main === module) {
  logger.info('Starting prediction worker...', {
    mlServiceUrl: ML_SERVICE_URL,
    concurrency: CONCURRENCY,
  });
  
  worker = startWorker();
}

export { startWorker };
