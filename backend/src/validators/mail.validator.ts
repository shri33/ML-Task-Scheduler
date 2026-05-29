import { z } from 'zod';

export const sendMailSchema = z.object({
  recipients: z.union([
    z.string().email('Invalid recipient email address'),
    z.array(z.string().email('Invalid recipient email address'))
  ]),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required')
});

export const markReadSchema = z.object({
  isRead: z.boolean()
});
