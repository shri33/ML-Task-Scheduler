import { z } from 'zod';

export const scheduleRequestSchema = z.object({
  algorithm: z.string().min(1, 'Algorithm name is required'),
  tasks: z.array(z.string().uuid()).optional(),
  resources: z.array(z.string().uuid()).optional()
});

export const scheduleParamsSchema = z.object({
  algorithm: z.string().optional(),
  strategy: z.string().optional()
});
