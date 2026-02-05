/**
 * ML Model Versioning Service
 * Handles database-backed model versioning and auto-retrain functionality
 */

import prisma from '../lib/prisma';
import axios from 'axios';
import { getWebSocket } from './websocket.service';

interface ModelMetrics {
  r2Score: number;
  maeScore?: number;
  rmseScore?: number;
  featureImportance: Record<string, number>;
}

interface TrainingData {
  taskSize: number;
  taskType: number;
  priority: number;
  resourceLoad: number;
  actualTime: number;
}

export class MLModelVersionService {
  private baseUrl: string;
  private isRetraining: boolean = false;

  constructor() {
    this.baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
  }

  /**
   * Register a new model version in the database
   */
  async registerModel(
    version: string,
    modelType: string,
    metrics: ModelMetrics,
    trainingDataSize: number,
    hyperparameters?: Record<string, any>
  ) {
    // Archive any existing active models of the same type
    await prisma.mlModel.updateMany({
      where: { 
        modelType,
        status: 'ACTIVE'
      },
      data: { 
        status: 'ARCHIVED',
        archivedAt: new Date()
      }
    });

    // Create new model record
    const model = await prisma.mlModel.create({
      data: {
        version,
        modelType,
        status: 'ACTIVE',
        r2Score: metrics.r2Score,
        maeScore: metrics.maeScore,
        rmseScore: metrics.rmseScore,
        trainingDataSize,
        featureImportance: metrics.featureImportance,
        hyperparameters: hyperparameters || {},
        modelPath: `models/${version}.joblib`,
        trainedAt: new Date()
      }
    });

    // Emit WebSocket event
    const ws = getWebSocket();
    ws?.emitMLModelUpdated(model);

    return model;
  }

  /**
   * Get the currently active model
   */
  async getActiveModel(modelType?: string) {
    return prisma.mlModel.findFirst({
      where: {
        status: 'ACTIVE',
        ...(modelType ? { modelType } : {})
      },
      orderBy: { trainedAt: 'desc' }
    });
  }

  /**
   * Get all model versions
   */
  async getAllModels(limit: number = 20) {
    return prisma.mlModel.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        trainingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  }

  /**
   * Get model performance comparison
   */
  async getModelComparison() {
    const models = await prisma.mlModel.findMany({
      where: { r2Score: { not: null } },
      orderBy: { trainedAt: 'desc' },
      take: 10,
      select: {
        version: true,
        modelType: true,
        r2Score: true,
        maeScore: true,
        trainingDataSize: true,
        trainedAt: true,
        status: true
      }
    });

    return models;
  }

  /**
   * Check if auto-retrain should be triggered
   */
  async checkAutoRetrain(): Promise<boolean> {
    const config = await this.getOrCreateRetrainConfig();
    
    if (!config.isEnabled) return false;
    
    // Check if enough data points accumulated
    if (config.pendingDataPoints < config.dataThreshold) return false;
    
    // Check minimum time between retrains
    if (config.lastRetrainAt) {
      const timeSinceLastRetrain = (Date.now() - config.lastRetrainAt.getTime()) / 1000;
      if (timeSinceLastRetrain < config.maxRetrainFrequency) return false;
    }

    return true;
  }

  /**
   * Increment pending data points and trigger auto-retrain if threshold reached
   */
  async recordNewDataPoint() {
    const config = await this.getOrCreateRetrainConfig();
    
    await prisma.autoRetrainConfig.update({
      where: { id: config.id },
      data: { pendingDataPoints: { increment: 1 } }
    });

    // Check if we should trigger auto-retrain
    if (await this.checkAutoRetrain()) {
      this.triggerAutoRetrain().catch(console.error);
    }
  }

  /**
   * Trigger automatic model retraining
   */
  async triggerAutoRetrain(): Promise<void> {
    if (this.isRetraining) {
      console.log('⏳ Retrain already in progress, skipping...');
      return;
    }

    this.isRetraining = true;
    const ws = getWebSocket();

    try {
      // Create training job record
      const job = await prisma.trainingJob.create({
        data: {
          status: 'running',
          triggerType: 'auto',
          dataPointsUsed: 0,
          startedAt: new Date()
        }
      });

      ws?.emitMLTrainingStarted({ jobId: job.id, triggerType: 'auto' });

      // Gather training data from completed tasks
      const trainingData = await this.gatherTrainingData();
      
      if (trainingData.length < 10) {
        await prisma.trainingJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: 'Insufficient training data (minimum 10 points required)',
            completedAt: new Date()
          }
        });
        ws?.emitMLTrainingFailed({ jobId: job.id, error: 'Insufficient training data' });
        return;
      }

      // Call ML service to retrain
      const response = await axios.post(
        `${this.baseUrl}/api/retrain`,
        { data: trainingData, incremental: true },
        { timeout: 60000 }
      );

      if (response.data.success) {
        const metrics = response.data.metrics;
        
        // Register new model version
        const model = await this.registerModel(
          response.data.modelVersion,
          metrics.model_type || 'random_forest',
          {
            r2Score: metrics.r2_score,
            featureImportance: metrics.feature_importance
          },
          trainingData.length
        );

        // Update training job
        await prisma.trainingJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            modelId: model.id,
            dataPointsUsed: trainingData.length,
            metrics: metrics,
            completedAt: new Date()
          }
        });

        // Reset pending data points
        await prisma.autoRetrainConfig.updateMany({
          data: {
            pendingDataPoints: 0,
            lastRetrainAt: new Date()
          }
        });

        ws?.emitMLTrainingCompleted({ jobId: job.id, model, metrics });
        console.log(`✅ Auto-retrain completed: ${model.version}`);
      }
    } catch (error: any) {
      console.error('❌ Auto-retrain failed:', error.message);
      ws?.emitMLTrainingFailed({ error: error.message });
    } finally {
      this.isRetraining = false;
    }
  }

  /**
   * Gather training data from completed schedule history
   */
  private async gatherTrainingData(): Promise<TrainingData[]> {
    const history = await prisma.scheduleHistory.findMany({
      where: {
        actualTime: { not: null },
        mlEnabled: true
      },
      include: {
        task: {
          select: { size: true, type: true, priority: true }
        },
        resource: {
          select: { currentLoad: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 500 // Use last 500 completed tasks
    });

    const sizeMap: Record<string, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
    const typeMap: Record<string, number> = { CPU: 1, IO: 2, MIXED: 3 };

    return history
      .filter(h => h.task && h.actualTime !== null)
      .map(h => ({
        taskSize: sizeMap[h.task.size] || 2,
        taskType: typeMap[h.task.type] || 1,
        priority: h.task.priority,
        resourceLoad: h.resource?.currentLoad || 50,
        actualTime: h.actualTime!
      }));
  }

  /**
   * Get or create auto-retrain configuration
   */
  private async getOrCreateRetrainConfig() {
    let config = await prisma.autoRetrainConfig.findFirst();
    
    if (!config) {
      config = await prisma.autoRetrainConfig.create({
        data: {
          isEnabled: true,
          dataThreshold: 100,
          accuracyThreshold: 0.85,
          maxRetrainFrequency: 3600,
          pendingDataPoints: 0
        }
      });
    }
    
    return config;
  }

  /**
   * Update auto-retrain configuration
   */
  async updateRetrainConfig(config: {
    isEnabled?: boolean;
    dataThreshold?: number;
    accuracyThreshold?: number;
    maxRetrainFrequency?: number;
  }) {
    const existing = await this.getOrCreateRetrainConfig();
    
    return prisma.autoRetrainConfig.update({
      where: { id: existing.id },
      data: config
    });
  }

  /**
   * Get auto-retrain configuration
   */
  async getRetrainConfig() {
    return this.getOrCreateRetrainConfig();
  }

  /**
   * Get training job history
   */
  async getTrainingJobs(limit: number = 20) {
    return prisma.trainingJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        model: {
          select: { version: true, modelType: true, r2Score: true }
        }
      }
    });
  }

  /**
   * Manually trigger model retraining
   */
  async triggerManualRetrain(modelType?: string): Promise<void> {
    if (this.isRetraining) {
      throw new Error('Retrain already in progress');
    }

    this.isRetraining = true;
    const ws = getWebSocket();

    try {
      const job = await prisma.trainingJob.create({
        data: {
          status: 'running',
          triggerType: 'manual',
          dataPointsUsed: 0,
          startedAt: new Date()
        }
      });

      ws?.emitMLTrainingStarted({ jobId: job.id, triggerType: 'manual' });

      const trainingData = await this.gatherTrainingData();
      
      const response = await axios.post(
        `${this.baseUrl}/api/train`,
        { data: trainingData },
        { timeout: 60000 }
      );

      if (response.data.success) {
        const metrics = response.data.metrics;
        
        const model = await this.registerModel(
          response.data.modelVersion,
          modelType || metrics.model_type || 'random_forest',
          {
            r2Score: metrics.r2_score,
            featureImportance: metrics.feature_importance
          },
          trainingData.length
        );

        await prisma.trainingJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            modelId: model.id,
            dataPointsUsed: trainingData.length,
            metrics: metrics,
            completedAt: new Date()
          }
        });

        ws?.emitMLTrainingCompleted({ jobId: job.id, model, metrics });
      }
    } catch (error: any) {
      ws?.emitMLTrainingFailed({ error: error.message });
      throw error;
    } finally {
      this.isRetraining = false;
    }
  }
}

export const mlModelVersionService = new MLModelVersionService();
