import { z } from 'zod';

export const CriticEvaluateSchema = z.object({
  episodeId: z.string().uuid({ message: 'Episode ID must be a valid UUID' }),
  provider: z.enum(['mock', 'openai', 'ollama']).default('mock'),
});

export type CriticEvaluateDto = z.infer<typeof CriticEvaluateSchema>;

export interface CriticSuggestedRuleChangeDto {
  ruleId?: string;
  ruleName?: string;
  action: 'ADJUST' | 'CREATE' | 'DELETE' | 'KEEP';
  reason: string;
  suggestedProperties?: Record<string, any>;
}

export interface CriticEvaluationResponseDto {
  id: string;
  userId: string;
  episodeId: string;
  verdict: string;
  confidence: number;
  explanation: string;
  strengths: string[];
  weaknesses: string[];
  suggestedRuleChanges: CriticSuggestedRuleChangeDto[];
  rawPrompt: string;
  rawResponse: string;
  createdAt: string;
}
