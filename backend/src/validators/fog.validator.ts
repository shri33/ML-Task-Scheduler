import { z } from 'zod';

export const createFogNodeSchema = z.object({
  name: z.string().min(1, 'Node name is required'),
  cpuCapacity: z.number().positive(),
  memoryCapacity: z.number().positive(),
  storageCapacity: z.number().positive().optional(),
  bandwidth: z.number().positive().optional(),
  vramCapacity: z.number().nonnegative().optional(),
  status: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).optional().default('AVAILABLE')
});

export const createFogTaskSchema = z.object({
  name: z.string().min(1),
  cpuRequired: z.number().positive(),
  memoryRequired: z.number().positive(),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE']).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  status: z.enum(['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED']).optional()
});

export const benchmarkParamsSchema = z.object({
  numTasks: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
  numNodes: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
  seed: z.string().optional().transform(val => val ? parseInt(val, 10) : 42),
  algorithm: z.string().optional()
});

export const fogNodeIdParamSchema = z.object({
  id: z.string().uuid('Invalid node ID format. Expected UUID.')
});

export const fogTaskIdParamSchema = z.object({
  id: z.string().uuid('Invalid task ID format. Expected UUID.')
});
export const benchmarkQuerySchema = benchmarkParamsSchema;
export const offloadingQuerySchema = z.object({
  taskId: z.string().uuid('Invalid task ID format. Expected UUID.').optional(),
  nodeId: z.string().uuid('Invalid node ID format. Expected UUID.').optional()
});
