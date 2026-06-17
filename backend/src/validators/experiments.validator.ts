import { z } from 'zod';

export const runExperimentSchema = z.object({
  name: z.string().min(1, 'Experiment name is required'),
  description: z.string().optional(),
  config: z.record(z.any()).optional()
});

export const experimentConfigSchema = z.object({
  algorithm: z.string().optional(),
  nodes: z.number().int().positive().optional(),
  tasks: z.number().int().positive().optional()
});
