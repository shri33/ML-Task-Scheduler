import axios from 'axios';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import logger from '../lib/logger';
import { errorRecovery } from './errorRecovery.service';
import redisService from '../lib/redis';
import crypto from 'crypto';

interface PredictionRequest {
  taskSize: number;  // 1=SMALL, 2=MEDIUM, 3=LARGE
  taskType: number;  // 1=CPU, 2=IO, 3=MIXED
  priority: number;  // 1-5
  resourceLoad: number;  // 0-100
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
}

interface BatchPredictionResult {
  taskId?: string;
  predictedTime: number;
  confidence: number;
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
  // Cache helpers
  // ---------------------------------------------------------------------------
  private cacheKey(req: PredictionRequest): string {
    const raw = `${req.taskSize}:${req.taskType}:${req.priority}:${Math.round(req.resourceLoad)}`;
    return `ml:pred:${crypto.createHash('md5').update(raw).digest('hex')}`;
  }

  private async getCached(key: string): Promise<PredictionResponse | null> {
    return redisService.getJSON<PredictionResponse>(key);
  }

  private async setCache(key: string, value: PredictionResponse): Promise<void> {
    await redisService.setJSON(key, value, PREDICTION_CACHE_TTL);
  }

  // ---------------------------------------------------------------------------
  // Single prediction (with cache)
  // ---------------------------------------------------------------------------
  async getPrediction(
    taskSize: string,
    taskType: string,
    priority: number,
    resourceLoad: number
  ): Promise<PredictionResponse> {
    const request: PredictionRequest = {
      taskSize: sizeMap[taskSize] || 2,
      taskType: typeMap[taskType] || 1,
      priority,
      resourceLoad
    };

    // Check Redis cache first
    const key = this.cacheKey(request);
    const cached = await this.getCached(key);
    if (cached) return cached;

    // Check circuit breaker before making request
    if (!errorRecovery.isServiceAvailable('ml-service')) {
      logger.warn('ML Service circuit breaker open, using fallback');
      return this.fallbackPrediction(taskSize, taskType, priority, resourceLoad);
    }

    try {
      const response = await axios.post<PredictionResponse>(
        `${this.baseUrl}/api/predict`,
        request,
        { timeout: 5000 }
      );

      errorRecovery.recordSuccess('ml-service');
      await this.setCache(key, response.data);
      return response.data;
    } catch (error) {
      errorRecovery.recordFailure('ml-service', error instanceof Error ? error : new Error(String(error)));
      logger.warn('ML Service unavailable, using fallback prediction', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return this.fallbackPrediction(taskSize, taskType, priority, resourceLoad);
    }
  }

  // ---------------------------------------------------------------------------
  // Batch prediction (single HTTP call instead of N sequential calls)
  // ---------------------------------------------------------------------------
  async getBatchPredictions(
    items: BatchPredictionItem[]
  ): Promise<Map<string, PredictionResponse>> {
    const results = new Map<string, PredictionResponse>();
    const uncached: BatchPredictionItem[] = [];
    const keyMap = new Map<string, string>(); // itemKey -> cacheKey

    // 1. Check cache for each item
    for (const item of items) {
      const req: PredictionRequest = {
        taskSize: item.taskSize,
        taskType: item.taskType,
        priority: item.priority,
        resourceLoad: item.resourceLoad
      };
      const key = this.cacheKey(req);
      const itemKey = item.taskId || `${item.taskSize}:${item.taskType}:${item.priority}:${item.resourceLoad}`;
      keyMap.set(itemKey, key);

      const cached = await this.getCached(key);
      if (cached) {
        results.set(itemKey, cached);
      } else {
        uncached.push({ ...item, taskId: itemKey });
      }
    }

    if (uncached.length === 0) return results;

    // 2. Call batch endpoint for uncached items
    if (!errorRecovery.isServiceAvailable('ml-service')) {
      logger.warn('ML Service circuit breaker open, using fallback for batch');
      for (const item of uncached) {
        const fb = this.fallbackPredictionNumeric(item.taskSize, item.taskType, item.priority, item.resourceLoad);
        results.set(item.taskId!, fb);
      }
      return results;
    }

    try {
      const response = await axios.post<{
        predictions: BatchPredictionResult[];
        modelVersion: string;
      }>(
        `${this.baseUrl}/api/predict/batch`,
        { tasks: uncached.map(u => ({
            taskId: u.taskId,
            taskSize: u.taskSize,
            taskType: u.taskType,
            priority: u.priority,
            resourceLoad: u.resourceLoad
          }))
        },
        { timeout: 15000 }
      );

      errorRecovery.recordSuccess('ml-service');
      const modelVersion = response.data.modelVersion;

      for (const pred of response.data.predictions) {
        const itemKey = pred.taskId || '';
        const res: PredictionResponse = {
          predictedTime: pred.predictedTime,
          confidence: pred.confidence,
          modelVersion
        };
        results.set(itemKey, res);
        // Cache individual result
        const cKey = keyMap.get(itemKey);
        if (cKey) await this.setCache(cKey, res);
      }
    } catch (error) {
      errorRecovery.recordFailure('ml-service', error instanceof Error ? error : new Error(String(error)));
      logger.warn('ML batch predict failed, using fallback', {
        error: error instanceof Error ? error.message : String(error)
      });
      for (const item of uncached) {
        const fb = this.fallbackPredictionNumeric(item.taskSize, item.taskType, item.priority, item.resourceLoad);
        results.set(item.taskId!, fb);
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
    return {
      isHealthy: true,
      fallbackMode: false,
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
}

export const mlService = new MLService();
