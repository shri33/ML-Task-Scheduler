import { z } from 'zod';

export const generateReportSchema = z.object({
  type: z.enum(['SUMMARY', 'DETAILED', 'ANALYTICAL']),
  format: z.enum(['PDF', 'CSV', 'JSON']).optional().default('PDF'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});
