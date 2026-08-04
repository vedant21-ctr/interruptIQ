import { z } from 'zod';

export const CreateMemoryEpisodeSchema = z.object({
  decisionId: z.string().uuid('Decision ID must be a valid UUID'),
  metadata: z.record(z.any()).optional().nullable(),
});

export const MemorySearchSchema = z.object({
  // Filters
  decisionType: z.string().optional(),
  category: z.string().optional(),
  userAction: z.string().optional(),
  startDate: z.string().datetime({ message: 'Start date must be a valid ISO datetime' }).optional(),
  endDate: z.string().datetime({ message: 'End date must be a valid ISO datetime' }).optional(),
  minConfidence: z.preprocess((val) => val ? parseFloat(val as string) : undefined, z.number().min(0).max(1).optional()),
  keyword: z.string().optional(),

  // Pagination
  page: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1)).default(1),
  limit: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).max(100)).default(20),
});

export type CreateMemoryEpisodeDto = z.infer<typeof CreateMemoryEpisodeSchema>;
export type MemorySearchDto = z.infer<typeof MemorySearchSchema>;

export interface MemoryEpisodeResponseDto {
  id: string;
  userId: string;
  eventId: string | null;
  decisionId: string | null;
  contextSnapshotId: string | null;
  decisionType: string;
  explanation: string;
  matchedRules: string[];
  confidence: number;
  feedbackSummary: string | null;
  outcome: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}
