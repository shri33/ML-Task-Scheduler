import { mlService } from '../ml.service';
import logger from '../../lib/logger';

// Enums mapping
export const sizeMap: Record<string, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
export const typeMap: Record<string, number> = { CPU: 1, IO: 2, MIXED: 3 };

export interface MLPredictionItem {
  taskId: string;
  taskSize: number;
  taskType: number;
  priority: number;
  resourceLoad: number;
  startupOverhead: number;
}

export class SchedulerMLIntegration {
  async getBatchPredictions(items: MLPredictionItem[]): Promise<Map<string, { predictedTime: number; confidence: number; modelVersion: string }>> {
    try {
      return await mlService.getBatchPredictions(items);
    } catch (err) {
      logger.error('Failed to fetch batch ML predictions, falling back', err instanceof Error ? err : new Error(String(err)));
      // Fallback prediction map
      const map = new Map<string, { predictedTime: number; confidence: number; modelVersion: string }>();
      for (const item of items) {
        map.set(item.taskId, {
          predictedTime: 5.0, // fallback 5 seconds
          confidence: 0.5,
          modelVersion: 'fallback-v1'
        });
      }
      return map;
    }
  }

  async getRLSchedulingOrder(items: any[]): Promise<any> {
    try {
      return await mlService.getRLSchedulingOrder(items);
    } catch (err) {
      logger.error('Failed to get RL scheduling order', err instanceof Error ? err : new Error(String(err)));
      return {
        schedulingOrder: items.map(i => i.taskId),
        agentUsed: false
      };
    }
  }

  async savePrediction(
    taskId: string,
    predictedTime: number,
    confidence: number,
    inputs: any,
    modelVersion: string
  ): Promise<void> {
    try {
      await mlService.savePrediction(taskId, predictedTime, confidence, inputs, modelVersion);
    } catch (err) {
      logger.warn('Failed to save ML prediction metadata', { error: err instanceof Error ? err.message : String(err) });
    }
  }
}

export const schedulerMLIntegration = new SchedulerMLIntegration();
