import { z } from 'zod';

export const MemoryRetrievalSchema = z.object({
  decisionType: z.string().optional().nullable(),
  eventSource: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  minConfidence: z.number().min(0).max(1).optional().nullable(),
  maxConfidence: z.number().min(0).max(1).optional().nullable(),
  feedbackType: z.string().optional().nullable(),
  keyword: z.string().optional().nullable(),
  startDate: z
    .string()
    .datetime({ message: 'Start date must be a valid ISO datetime' })
    .optional()
    .nullable(),
  endDate: z
    .string()
    .datetime({ message: 'End date must be a valid ISO datetime' })
    .optional()
    .nullable(),

  currentContext: z
    .object({
      focusLevel: z.number().int().min(0).max(100).optional().nullable(),
      workingMode: z.string().optional().nullable(),
      activity: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),

  targetConfidence: z.number().min(0).max(1).optional().nullable(),

  page: z
    .preprocess(
      (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
      z.number().int().min(1)
    )
    .default(1),
  limit: z
    .preprocess(
      (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
      z.number().int().min(1).max(100)
    )
    .default(5),
});

export type MemoryRetrievalDto = z.infer<typeof MemoryRetrievalSchema>;

export interface RetrievalResultItemDto {
  episode: {
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
  };
  relevanceScore: number;
  matchingReasons: string[];
  historicalOutcome: string;
}

export interface RetrievalResponseDto {
  success: boolean;
  items: RetrievalResultItemDto[];
  total: number;
  page: number;
  limit: number;
}
