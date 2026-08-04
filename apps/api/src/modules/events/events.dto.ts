import { z } from 'zod';

export const CreateEventSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  sender: z.string().min(1, 'Sender is required'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  category: z.enum(['social', 'development', 'system', 'urgent']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'processed', 'ignored']).default('pending'),
  payload: z.record(z.any()).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const EventQuerySchema = z.object({
  // Filtering
  source: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  
  // Searching
  title: z.string().optional(),
  sender: z.string().optional(),
  
  // Pagination
  page: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1)).default(1),
  limit: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).max(100)).default(20),
});

export type CreateEventDto = z.infer<typeof CreateEventSchema>;
export type EventQueryDto = z.infer<typeof EventQuerySchema>;

export interface EventResponseDto {
  id: string;
  userId: string;
  source: string;
  sender: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  status: string;
  payload: Record<string, any> | null;
  metadata: Record<string, any> | null;
  timestamp: string;
  createdAt: string;
}
