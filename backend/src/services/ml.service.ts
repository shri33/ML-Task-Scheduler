import axios from 'axios';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { getWebSocket } from './websocket.service';
import { 
  MLServiceUnavailableError, 
  MLPredictionError,
  MLValidationError 
} from '../middleware/errorHandler';

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
  private isHealthy: boolean = true;
  private consecutiveFailures: number = 0;
  private readonly maxConsecutiveFailures: number = 3;

  constructor() {
    this.baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
  }

  /**
   * Validate prediction input features
   */
  private validateFeatures(request: PredictionRequest): void {
    const errors: Array<{ field: string; message: string }> = [];

    if (request.taskSize < 1 || request.taskSize > 3) {
      errors.push({ field: 'taskSize', message: 'Must be 1 (SMALL), 2 (MEDIUM), or 3 (LARGE)' });
    }
    if (request.taskType < 1 || request.taskType > 3) {
      errors.push({ field: 'taskType', message: 'Must be 1 (CPU), 2 (IO), or 3 (MIXED)' });
    }
    if (request.priority < 1 || request.priority > 5) {
      errors.push({ field: 'priority', message: 'Must be between 1 and 5' });
    }
    if (request.resourceLoad < 0 || request.resourceLoad > 100) {
      errors.push({ field: 'resourceLoad', message: 'Must be between 0 and 100' });
    }

    if (errors.length > 0) {
      throw new MLValidationError('Invalid prediction features', errors);
    }
  }

  async getPrediction(
    taskSize: string,
    taskType: string,
    priority: number,
    resourceLoad: number
  ): Promise<PredictionResponse> {
    const request: PredictionRequest = {
      taskSize: sizeMap[taskSize] || 2,
      taskType: typeMap[taskType] || 1,
      priority: Math.max(1, Math.min(5, priority)),
      resourceLoad: Math.max(0, Math.min(100, resourceLoad))
    };

    // Validate features
    this.validateFeatures(request);

    try {
      const response = await axios.post<PredictionResponse>(
        `${this.baseUrl}/api/predict`,
        request,
        { timeout: 5000 }
      );

      // Reset failure counter on success
      this.consecutiveFailures = 0;
      if (!this.isHealthy) {
        this.isHealthy = true;
        const ws = getWebSocket();
        ws?.emitMLServiceHealthChange({ isHealthy: true, fallbackMode: false });
      }

      // Emit prediction event
      const ws = getWebSocket();
      ws?.emitMLPredictionMade({
        taskId: '', // Will be set by caller
        predictedTime: response.data.predictedTime,
        confidence: response.data.confidence,
        modelVersion: response.data.modelVersion
      });

      return response.data;
    } catch (error: any) {
      this.consecutiveFailures++;
      
      // Log detailed error for debugging
      console.warn(`ML Service error (attempt ${this.consecutiveFailures}):`, {
        message: error.message,
        code: error.code,
        url: `${this.baseUrl}/api/predict`
      });

      // Check if we should mark service as unhealthy
      if (this.consecutiveFailures >= this.maxConsecutiveFailures && this.isHealthy) {
        this.isHealthy = false;
        const ws = getWebSocket();
        ws?.emitMLServiceHealthChange({ isHealthy: false, fallbackMode: true });
        ws?.emitSystemAlert({
          type: 'warning',
          title: 'ML Service Unavailable',
          message: 'The ML service is temporarily unavailable. Using fallback predictions.'
        });
      }

      // Use fallback prediction
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
    try {
      return await prisma.prediction.create({
        data: {
          taskId,
          predictedTime,
          confidence,
          features: features as unknown as Prisma.InputJsonValue,
          modelVersion
        }
      });
    } catch (error: any) {
      console.error('Failed to save prediction:', error.message);
      // Don't throw - saving prediction failure shouldn't block scheduling
      return null;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/health`, { timeout: 2000 });
      const wasHealthy = this.isHealthy;
      this.isHealthy = response.status === 200;
      
      // Emit health change event
      if (wasHealthy !== this.isHealthy) {
        const ws = getWebSocket();
        ws?.emitMLServiceHealthChange({ isHealthy: this.isHealthy, fallbackMode: !this.isHealthy });
      }
      
      return this.isHealthy;
    } catch {
      if (this.isHealthy) {
        this.isHealthy = false;
        const ws = getWebSocket();
        ws?.emitMLServiceHealthChange({ isHealthy: false, fallbackMode: true });
      }
      return false;
    }
  }

  /**
   * Get current health status without making a request
   */
  getHealthStatus(): { isHealthy: boolean; consecutiveFailures: number } {
    return {
      isHealthy: this.isHealthy,
      consecutiveFailures: this.consecutiveFailures
    };
  }

  /**
   * Get model information from ML service
   */
  async getModelInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/model/info`, { timeout: 5000 });
      return response.data;
    } catch (error: any) {
      throw new MLServiceUnavailableError(`Failed to get model info: ${error.message}`);
    }
  }

  /**
   * Compare predictions from different model types
   */
  async compareModels(features: PredictionRequest): Promise<any> {
    this.validateFeatures(features);
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/model/compare`,
        features,
        { timeout: 30000 }
      );
      return response.data;
    } catch (error: any) {
      throw new MLServiceUnavailableError(`Model comparison failed: ${error.message}`);
    }
  }
}

export const mlService = new MLService();
