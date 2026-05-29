import { z } from 'zod';

export const gpuRegistrationSchema = z.object({
  id: z.string().min(1, 'GPU node ID is required'),
  host: z.string().min(1, 'Host address is required'),
  gpuType: z.string().min(1, 'GPU type is required'),
  vramTotal: z.number().nonnegative('Total VRAM must be non-negative'),
  vramUsed: z.number().nonnegative('Used VRAM must be non-negative'),
  utilization: z.number().min(0).max(100, 'Utilization must be between 0 and 100'),
  queue: z.number().int().nonnegative().optional().default(0)
});
