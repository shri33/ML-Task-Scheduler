import { z } from 'zod';

export const registerDeviceSchema = z.object({
  name: z.string().min(1, 'Device name is required'),
  type: z.string().min(1, 'Device type is required'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OFFLINE']).optional().default('ACTIVE'),
  ipAddress: z.string().ip().optional()
});

export const deviceMetricSchema = z.object({
  cpuUsage: z.number().min(0).max(100),
  memoryUsage: z.number().min(0).max(100),
  diskUsage: z.number().min(0).max(100).optional(),
  networkLatency: z.number().nonnegative().optional()
});
