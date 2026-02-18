import axios from 'axios';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import logger from '../lib/logger';
import { errorRecovery } from './errorRecovery.service';

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

// Map enums to numbers for ML model
const sizeMap: Record<string, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
const typeMap: Record<string, number> = { CPU: 1, IO: 2, MIXED: 3 };

export class MLService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
  }

  async getPrediction(
    taskSize: string,
    taskType: string,
    priority: number,
    resourceLoad: number
  ): Promise<PredictionResponse> {
    // Check circuit breaker before making request
    if (!errorRecovery.isServiceAvailable('ml-service')) {
      logger.warn('ML Service circuit breaker open, using fallback');
      return this.fallbackPrediction(taskSize, taskType, priority, resourceLoad);
    }

    try {
      const request: PredictionRequest = {
        taskSize: sizeMap[taskSize] || 2,
        taskType: typeMap[taskType] || 1,
        priority,
        resourceLoad
      };

      const response = await axios.post<PredictionResponse>(
        `${this.baseUrl}/api/predict`,
        request,
        { timeout: 5000 }
      );

      // Record success for circuit breaker
      errorRecovery.recordSuccess('ml-service');
      return response.data;
    } catch (error) {
      // Record failure for circuit breaker
      errorRecovery.recordFailure('ml-service', error instanceof Error ? error : new Error(String(error)));
      logger.warn('ML Service unavailable, using fallback prediction', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return this.fallbackPrediction(taskSize, taskType, priority, resourceLoad);
    }
  }

  // Fallback when ML service is unavailable
  private fallbackPrediction(
    taskSize: string,
    taskType: string,
    priority: number,
    resourceLoad: number
  ): PredictionResponse {
    // Simple heuristic-based prediction
    const sizeWeight = sizeMap[taskSize] || 2;
    const typeWeight = taskType === 'IO' ? 1.5 : taskType === 'MIXED' ? 1.2 : 1;
    const loadFactor = 1 + (resourceLoad / 100);
    
    const baseTime = 2; // Base execution time in seconds
    const predictedTime = baseTime * sizeWeight * typeWeight * loadFactor;

    return {
      predictedTime: Math.round(predictedTime * 100) / 100,
      confidence: 0.65, // Lower confidence for fallback
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
