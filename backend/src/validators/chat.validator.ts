import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  recipientId: z.string().uuid('Invalid recipient ID format. Expected UUID.').optional()
});
