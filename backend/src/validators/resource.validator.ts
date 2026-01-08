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

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
