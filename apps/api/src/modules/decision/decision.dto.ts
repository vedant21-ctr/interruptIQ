import { z } from 'zod';

export const EvaluateDecisionSchema = z.object({
  eventId: z.string().uuid('Event ID must be a valid UUID'),
});

export const DecisionHistoryQuerySchema = z.object({
  page: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1)).default(1),
  limit: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).max(100)).default(20),
});

export type EvaluateDecisionDto = z.infer<typeof EvaluateDecisionSchema>;
export type DecisionHistoryQueryDto = z.infer<typeof DecisionHistoryQuerySchema>;

export interface DecisionExplanationDto {
  narrative: string;
  rulesAttribution: number;
  semanticsAttribution: number;
  mlAttribution: number;
  historyAttribution: number;
}

export interface DecisionResponseDto {
  id: string;
  eventId: string;
  contextSnapshotId: string | null;
  decision: string;
  reason: string;
  confidence: number;
  signalsUsed: string[];
  explanation: DecisionExplanationDto | null;
  createdAt: string;
}
