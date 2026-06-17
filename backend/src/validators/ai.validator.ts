import { z } from 'zod';

export const aiChatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string()
    })
  ).optional()
});

export const generateScenarioSchema = z.object({
  description: z.string().min(1, 'Scenario description is required')
});

export const aiQuerySchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  context: z.string().optional()
});
