import axios from 'axios';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import logger from '../lib/logger';
import { errorRecovery } from './errorRecovery.service';
import { getRequestId } from '../utils/context';
import redisService from '../lib/redis';
import crypto from 'crypto';
import { chaosService } from './chaos.service';

interface PredictionRequest {
  taskSize: number;  // 1=SMALL, 2=MEDIUM, 3=LARGE
  taskType: number;  // 1=CPU, 2=IO, 3=MIXED
  priority: number;  // 1-5
  resourceLoad: number;  // 0-100
  startupOverhead: number; // In seconds
}

interface PredictionResponse {
  predictedTime: number;
  confidence: number;
  modelVersion: string;
}

interface BatchPredictionItem {
  taskId?: string;
  taskSize: number;
  taskType: number;
  priority: number;
  resourceLoad: number;
  startupOverhead: number;
}

interface BatchPredictionResult {
  taskId?: string;
  predictedTime: number;
  confidence: number;
}

interface RLTaskPayload {
  taskId: string;
  taskSize: number;
  taskType: number;
  priority: number;
  resourceLoad: number;
  dueDate: number | null;
}

interface RLSchedulingResponse {
  schedulingOrder: string[];
  modelVersion: string;
  agentUsed: boolean;
  taskCount: number;
}

export interface AnomalyTask {
  taskId?: string;
  taskSize: number;
  taskType: number;
  priority: number;
  resourceLoad: number;
  actualTime: number;
  startupOverhead?: number;
}

export interface AnomalyResult {
  index: number;
  taskId?: string;
  actualTime: number;
  features: {
    size: number;
    type: number;
    load: number;
  };
}

export interface AnomalyResponse {
  anomalies: AnomalyResult[];
  count: number;
  totalProcessed: number;
  contamination: number;
  modelVersion: string;
}

// Map enums to numbers for ML model
const sizeMap: Record<string, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
const typeMap: Record<string, number> = { CPU: 1, IO: 2, MIXED: 3 };

/** Redis cache TTL for predictions (seconds). */
const PREDICTION_CACHE_TTL = 300; // 5 minutes

export class MLService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
  }

  // ---------------------------------------------------------------------------
  // Cache & Stampede Protection
  // ---------------------------------------------------------------------------
  
  /** In-memory cache to prevent concurrent redundant requests for the same key. */
  private pendingRequests = new Map<string, Promise<PredictionResponse>>();

  private cacheKey(req: PredictionRequest): string {
    // Sort keys for deterministic JSON serialization
    const sorted = {
      priority: req.priority,
      resourceLoad: Math.round(req.resourceLoad * 10) / 10, // 0.1 precision
      startupOverhead: Math.round(req.startupOverhead * 10) / 10,
      taskSize: req.taskSize,
      taskType: req.taskType
    };
    const raw = JSON.stringify(sorted);
    return `ml:pred:${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
  }

  private async getCached(key: string): Promise<PredictionResponse | null> {
    const cached = await redisService.getJSON<PredictionResponse>(key);
    if (cached) logger.info(`ML Cache Hit: ${key}`);
    return cached;
  }

  private async setCache(key: string, value: PredictionResponse): Promise<void> {
    logger.info(`Caching ML prediction: ${key}`);
    await redisService.setJSON(key, value, PREDICTION_CACHE_TTL);
  }

  /** Clear all prediction cache entries. */
  async clearAllPredictions(): Promise<void> {
    // In a production environment with many keys, use SCAN instead of KEYS
    const client = redisService.getClient();
    if (client) {
      const keys = await client.keys('ml:pred:*');
      if (keys.length > 0) {
        await client.del(...keys);
      }
      logger.info(`Cleared ${keys.length} ML prediction cache entries`);
    }
  }

  async getPrediction(
    taskSize: string,
    taskType: string,
    priority: number,
    resourceLoad: number,
    startupOverhead: number = 1.0
  ): Promise<PredictionResponse> {
    await chaosService.applyChaos('ml-service');
    const request: PredictionRequest = {
      taskSize: sizeMap[taskSize] || 2,
      taskType: typeMap[taskType] || 1,
      priority,
      resourceLoad,
      startupOverhead
    };

    const key = this.cacheKey(request);

    // 1. Check Redis cache first
    const cached = await this.getCached(key);
    if (cached) {
      logger.info(`ML Cache Hit: ${key}`, { taskSize, taskType, priority });
      return cached;
    }

    // 2. Check stampede protection (ongoing request for same key)
    const pending = this.pendingRequests.get(key);
    if (pending) {
      logger.info(`ML Cache Stampede Protected: waiting for ${key}`);
      return pending;
    }

    // 3. Check circuit breaker
    if (!errorRecovery.isServiceAvailable('ml-service')) {
      logger.warn('ML Service circuit breaker open, using fallback');
      return this.fallbackPrediction(taskSize, taskType, priority, resourceLoad);
    }

    // 4. Create new request promise
    const predictionPromise = (async () => {
      const start = Date.now();
      try {
        const requestId = getRequestId();
        const response = await axios.post<PredictionResponse>(
          `${this.baseUrl}/api/predict`,
          request,
          { 
            timeout: 5000,
            headers: requestId ? { 'x-request-id': requestId } : undefined
          }
        );

        errorRecovery.recordSuccess('ml-service');
        const duration = Date.now() - start;
        logger.info(`ML Prediction Success: ${key} in ${duration}ms`);
        
        await this.setCache(key, response.data);
        return response.data;
      } catch (error) {
        errorRecovery.recordFailure('ml-service', error instanceof Error ? error : new Error(String(error)));
        logger.warn('ML Service unavailable, using fallback prediction', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        return this.fallbackPrediction(taskSize, taskType, priority, resourceLoad);
      } finally {
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, predictionPromise);
    return predictionPromise;
  }

  async getBatchPredictions(
    items: BatchPredictionItem[]
  ): Promise<Map<string, PredictionResponse>> {
    const results = new Map<string, PredictionResponse>();
    const uncached: BatchPredictionItem[] = [];
    const itemKeyToCacheKey = new Map<string, string>();

    // 1. Check cache for all items in parallel
    const cacheChecks = await Promise.all(items.map(async (item) => {
      const req: PredictionRequest = {
        taskSize: item.taskSize,
        taskType: item.taskType,
        priority: item.priority,
        resourceLoad: item.resourceLoad,
        startupOverhead: item.startupOverhead || 1.0
      };
      const key = this.cacheKey(req);
      const itemKey = item.taskId || `${item.taskSize}:${item.taskType}:${item.priority}:${item.resourceLoad}`;
      
      const cached = await this.getCached(key);
      return { item, itemKey, key, cached };
    }));

    for (const { item, itemKey, key, cached } of cacheChecks) {
      itemKeyToCacheKey.set(itemKey, key);
      if (cached) {
        results.set(itemKey, cached);
      } else {
        uncached.push({ ...item, taskId: itemKey });
      }
    }

    if (uncached.length === 0) {
      logger.info(`ML Batch Cache Hit: 100% (${items.length}/${items.length})`);
      return results;
    }

    // 2. Call batch endpoint for remaining items
    if (!errorRecovery.isServiceAvailable('ml-service')) {
      logger.warn('ML Service circuit breaker open, using fallback for batch');
      for (const item of uncached) {
        results.set(item.taskId!, this.fallbackPredictionNumeric(item.taskSize, item.taskType, item.priority, item.resourceLoad));
      }
      return results;
    }

    const start = Date.now();
    try {
      const requestId = getRequestId();
      const response = await axios.post<{
        predictions: BatchPredictionResult[];
        modelVersion: string;
      }>(
        `${this.baseUrl}/api/predict/batch`,
        { tasks: uncached },
        { 
          timeout: 15000,
          headers: requestId ? { 'x-request-id': requestId } : undefined
        }
      );

      errorRecovery.recordSuccess('ml-service');
      const modelVersion = response.data.modelVersion;
      const duration = Date.now() - start;
      logger.info(`ML Batch Success: ${uncached.length} items in ${duration}ms`);

      for (const pred of response.data.predictions) {
        const itemKey = pred.taskId || '';
        const res: PredictionResponse = {
          predictedTime: pred.predictedTime,
          confidence: pred.confidence,
          modelVersion
        };
        results.set(itemKey, res);
        
        // Cache individual result for future use
        const cKey = itemKeyToCacheKey.get(itemKey);
        if (cKey) await this.setCache(cKey, res);
      }
    } catch (error) {
      errorRecovery.recordFailure('ml-service', error instanceof Error ? error : new Error(String(error)));
      logger.warn('ML batch predict failed, using fallback', {
        error: error instanceof Error ? error.message : String(error)
      });
      for (const item of uncached) {
        results.set(item.taskId!, this.fallbackPredictionNumeric(item.taskSize, item.taskType, item.priority, item.resourceLoad));
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Fallback when ML service is unavailable
  // ---------------------------------------------------------------------------
  private fallbackPrediction(
    taskSize: string,
    taskType: string,
    priority: number,
    resourceLoad: number
  ): PredictionResponse {
    return this.fallbackPredictionNumeric(
      sizeMap[taskSize] || 2,
      typeMap[taskType] || 1,
      priority,
      resourceLoad
    );
  }

  private fallbackPredictionNumeric(
    taskSize: number,
    taskType: number,
    priority: number,
    resourceLoad: number
  ): PredictionResponse {
    const typeWeight = taskType === 2 ? 1.5 : taskType === 3 ? 1.2 : 1;
    const loadFactor = 1 + (resourceLoad / 100);
    
    const baseTime = 2;
    const predictedTime = baseTime * taskSize * typeWeight * loadFactor;

    return {
      predictedTime: Math.round(predictedTime * 100) / 100,
      confidence: 0.65,
      modelVersion: 'fallback-v1'
    };
  }

  async savePrediction(
    taskId: string,
    predictedTime: number,
    confidence: number,
    features: PredictionRequest,
    modelVersion: string
  ) {
    return prisma.prediction.create({
      data: {
        taskId,
        predictedTime,
        confidence,
        features: features as unknown as Prisma.InputJsonValue,
        modelVersion
      }
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/health`, { timeout: 2000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async getModelInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/model/info`, { timeout: 3000 });
      return response.data;
    } catch {
      return null;
    }
  }

  getHealthStatus(): { isHealthy: boolean; fallbackMode: boolean; lastCheck: Date } {
    const available = errorRecovery.isServiceAvailable('ml-service');
    return {
      isHealthy: available,
      fallbackMode: !available,
      lastCheck: new Date()
    };
  }

  async compareModels(params: { features: any; modelTypes?: string[] }): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/model/compare`, params, { timeout: 10000 });
      return response.data;
    } catch {
      return { error: 'Model comparison unavailable' };
    }
  }

  // ---------------------------------------------------------------------------
  // RL scheduling order — calls /api/predict/rl
  // Returns null if RL service is unavailable (caller falls back to ML-enhanced)
  // ---------------------------------------------------------------------------
  async getRLSchedulingOrder(
    tasks: RLTaskPayload[],
    userProfile?: {
      avgCompletionRate: number;
      avgLateness: number;
      productivityPattern: number;
      preferredWorkTime: number;
    }
  ): Promise<RLSchedulingResponse | null> {
    if (!errorRecovery.isServiceAvailable('ml-service')) {
      logger.warn('ML Service circuit breaker open, skipping RL scheduling');
      return null;
    }

    try {
      const response = await axios.post<RLSchedulingResponse>(
        `${this.baseUrl}/api/predict/rl`,
        { tasks, userProfile },
        { timeout: 15000 },
      );
      errorRecovery.recordSuccess('ml-service');
      return response.data;
    } catch (error) {
      errorRecovery.recordFailure(
        'ml-service',
        error instanceof Error ? error : new Error(String(error)),
      );
      logger.warn('RL scheduling endpoint failed, caller will fall back', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Anomaly Detection — calls /api/anomalies
  // ---------------------------------------------------------------------------
  async getAnomalies(tasks: AnomalyTask[], contamination: number = 0.05): Promise<AnomalyResponse | null> {
    if (!errorRecovery.isServiceAvailable('ml-service')) {
      logger.warn('ML Service circuit breaker open, skipping anomaly detection');
      return null;
    }

    try {
      const response = await axios.post<AnomalyResponse>(
        `${this.baseUrl}/api/anomalies`,
        { tasks, contamination },
        { timeout: 10000 }
      );
      errorRecovery.recordSuccess('ml-service');
      return response.data;
    } catch (error) {
      errorRecovery.recordFailure('ml-service', error instanceof Error ? error : new Error(String(error)));
      logger.error('ML anomaly detection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get SHAP explainability for a specific prediction
   */
  async getExplainability(taskId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/explain/${taskId}`, { timeout: 5000 });
      return response.data;
    } catch {
      return null;
    }
  }
}

export const mlService = new MLService();
