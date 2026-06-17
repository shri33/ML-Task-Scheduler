import { z } from 'zod';

export const createResourceSchema = z.object({
  name: z.string().min(1, 'Resource name is required').max(255),
  capacity: z.number().int().min(1, 'Capacity must be at least 1')
});

export const updateResourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  capacity: z.number().int().min(1).optional(),
  currentLoad: z.number().min(0).max(100).optional(),
  status: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).optional()
});

export const resourceIdParamSchema = z.object({
  id: z.string().uuid('Invalid resource ID format. Expected UUID.')
});

export const resourceQuerySchema = z.object({
  status: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20)
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
