import { z } from 'zod';

export const predictSchema = z.object({
  taskId: z.string().uuid(),
  features: z.array(z.number())
});

export const batchPredictSchema = z.object({
  tasks: z.array(z.object({
    taskId: z.string().uuid(),
    features: z.array(z.number())
  }))
});

export const retrainSchema = z.object({
  modelType: z.string().min(1, 'Model type is required'),
  params: z.record(z.any()).optional()
});
