import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['ADMIN', 'USER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['ADMIN', 'USER', 'VIEWER']).optional().default('USER'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  emailOnTaskComplete: z.boolean().optional(),
  emailOnTaskFailed: z.boolean().optional(),
  emailDailySummary: z.boolean().optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format. Expected UUID.')
});
