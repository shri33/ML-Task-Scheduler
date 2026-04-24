/**
 * Queue Job Types
 * Type definitions for all BullMQ queue jobs
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
  algorithm: 'hybrid' | 'ipso' | 'iaco' | 'round-robin' | 'min-min' |
    // New: user-task scheduling algorithms
    'ml_enhanced' | 'hybrid_heuristic' | 'fcfs' | 'edf' | 'sjf' | 'rl_ppo';
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

/** New: Event-driven task scheduling — triggered by task CRUD operations */
export interface TaskEventJobData {
  eventType: 'task_created' | 'task_updated' | 'task_deleted' | 'task_completed';
  taskId: string;
  userId?: string;
  algorithm?: string;
  requestedAt: string;
}

export interface TaskEventJobResult {
  eventType: string;
  scheduledTasks: number;
  algorithm: string;
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
  SCHEDULE_USER_TASKS: 'schedule-user-tasks',
  TASK_EVENT: 'task-event',
  NOTIFY: 'notify',
} as const;
