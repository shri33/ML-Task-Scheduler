/**
 * Prediction Job Types
 * Type definitions for ML prediction queue jobs
 */

export interface PredictionJobData {
  taskId: string;
  taskSize: string;
  taskType: string;
  priority: number;
  resourceLoad: number;
  requestedAt: string;
  requestedBy?: string;
}

export interface PredictionJobResult {
  taskId: string;
  predictedTime: number;
  confidence: number;
  modelVersion: string;
  processedAt: string;
  latencyMs: number;
}

export interface SchedulingJobData {
  taskIds: string[];
  algorithm: 'hybrid' | 'ipso' | 'iaco' | 'round-robin' | 'min-min';
  requestedAt: string;
  requestedBy?: string;
}

export interface SchedulingJobResult {
  allocations: Array<{ taskId: string; fogNodeId: string }>;
  totalDelay: number;
  totalEnergy: number;
  reliability: number;
  processedAt: string;
  latencyMs: number;
}

export interface NotificationJobData {
  type: 'task-completed' | 'task-failed' | 'prediction-ready' | 'scheduling-done';
  userId?: string;
  taskId?: string;
  payload: Record<string, unknown>;
  channels: Array<'websocket' | 'email'>;
}

export const JOB_NAMES = {
  PREDICT: 'predict',
  PREDICT_BATCH: 'predict-batch',
  SCHEDULE: 'schedule',
  NOTIFY: 'notify',
} as const;
