import { z } from 'zod';

export const CreateFeedbackSchema = z.object({
  decisionId: z.string().uuid('Decision ID must be a valid UUID'),
  userAction: z.enum(['ACCEPTED', 'OVERRIDDEN', 'DISMISSED', 'RESTORED', 'CUSTOM']),
  comment: z.string().optional().nullable(),
});

export type CreateFeedbackDto = z.infer<typeof CreateFeedbackSchema>;

export interface FeedbackResponseDto {
  id: string;
  decisionId: string;
  originalDecision: string;
  userAction: string;
  comment: string | null;
  createdAt: string;
}

export interface FeedbackAnalyticsResponseDto {
  overrideRate: number;     // e.g. 0.25 (25%)
  acceptanceRate: number;   // e.g. 0.60 (60%)
  dismissRate: number;      // e.g. 0.15 (15%)
  totalFeedbacks: number;
}
