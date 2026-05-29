import { z } from 'zod';

export const createTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required').max(255),
  type: z.enum(['CPU', 'IO', 'MIXED']),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE']),
  priority: z.number().int().min(1).max(5),
  dueDate: z.string().datetime().optional().nullable()
});

export const updateTaskSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['CPU', 'IO', 'MIXED']).optional(),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE']).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  status: z.enum(['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED']).optional(),
  dueDate: z.string().datetime().optional().nullable()
});

export const taskIdParamSchema = z.object({
  id: z.string().uuid('Invalid task ID format. Expected UUID.')
});

export const taskQuerySchema = z.object({
  status: z.enum(['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED']).optional(),
  priority: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20)
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
