import { z } from 'zod';

export const startChaosSchema = z.object({
  service: z.string().min(1, 'Service is required'),
  type: z.enum(['LATENCY', 'PACKET_LOSS', 'NODE_FAILURE', 'CPU_SPIKE']),
  value: z.number().nonnegative().optional()
});

export const stopChaosSchema = z.object({
  service: z.string().min(1, 'Service is required'),
  type: z.enum(['LATENCY', 'PACKET_LOSS', 'NODE_FAILURE', 'CPU_SPIKE'])
});

export const chaosExperimentSchema = z.object({
  type: z.enum(['LATENCY', 'PACKET_LOSS', 'NODE_FAILURE', 'CPU_SPIKE']),
  target: z.string().min(1, 'Target is required'),
  duration: z.number().int().positive('Duration must be positive'),
  value: z.number().nonnegative().optional()
});
