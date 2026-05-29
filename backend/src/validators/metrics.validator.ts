import { z } from 'zod';

export const metricsQuerySchema = z.object({
  range: z.string().optional().default('24h'),
  step: z.string().optional()
});
