import { PrismaClient } from '@prisma/client';
import { CriticRepository } from './critic.repository';
import { PromptBuilder } from './prompt-builder';
import { MockProvider, OpenAIProvider, OllamaProvider, CriticProvider } from './critic.providers';
import { MemoryRetriever } from '../retrieval/memory-retriever';
import { NotFoundError } from '../../errors/app-error';
import { CriticEvaluationResponseDto, CriticSuggestedRuleChangeDto } from './critic.dto';

export class CriticService {
  private repository: CriticRepository;
  private prisma: PrismaClient;
  private retriever: MemoryRetriever;

  constructor(repository: CriticRepository, prisma: PrismaClient, retriever: MemoryRetriever) {
    this.repository = repository;
    this.prisma = prisma;
    this.retriever = retriever;
  }

  async evaluateEpisode(
    userId: string,
    episodeId: string,
    providerType: 'mock' | 'openai' | 'ollama'
  ): Promise<CriticEvaluationResponseDto> {
    // 1. Fetch memory episode with event and contextsnapshot
    const episode = await this.prisma.memoryEpisode.findFirst({
      where: { id: episodeId, userId },
      include: {
        event: true,
        contextSnapshot: true,
        decision: {
          include: {
            feedbacks: true,
          },
        },
      },
    });

    if (!episode) {
      throw new NotFoundError(`Memory Episode with ID ${episodeId} not found`);
    }

    // 2. Fetch similar historical episodes via retrieval engine
    const searchParams = {
      category: episode.event?.category,
      eventSource: episode.event?.source,
      decisionType: episode.decisionType,
      targetConfidence: episode.confidence,
      page: 1,
      limit: 3,
    };
    const retrievalResult = await this.retriever.retrieve(userId, searchParams);

    // Filter out the current episode from the retrieved similar list to prevent self-reference in prompt
    const similarEpisodes = retrievalResult.items.filter((item) => item.episode.id !== episode.id);

    // 3. Compile prompt
    const prompt = PromptBuilder.buildCriticPrompt({
      event: episode.event,
      decision: episode.decision,
      context: episode.contextSnapshot,
      feedbackHistory: episode.decision?.feedbacks || [],
      similarEpisodes,
    });

    // 4. Select Provider
    let provider: CriticProvider;
    if (providerType === 'openai') {
      provider = new OpenAIProvider();
    } else if (providerType === 'ollama') {
      provider = new OllamaProvider();
    } else {
      provider = new MockProvider();
    }

    // 5. Evaluate
    const evaluation = await provider.evaluate(prompt, episode);

    // 6. Save in Repository
    const created = await this.repository.createEvaluation({
      userId,
      episodeId: episode.id,
      verdict: evaluation.verdict,
      confidence: evaluation.confidence,
      explanation: evaluation.explanation,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      suggestedRuleChanges: evaluation.suggestedRuleChanges,
      rawPrompt: prompt,
      rawResponse: evaluation.rawResponse,
    });

    return this.mapToResponse(created);
  }

  async getEvaluationById(id: string, userId: string): Promise<CriticEvaluationResponseDto> {
    const evaluation = await this.repository.findEvaluationById(id, userId);
    if (!evaluation) {
      throw new NotFoundError(`Critic Evaluation with ID ${id} not found`);
    }
    return this.mapToResponse(evaluation);
  }

  async getEvaluationHistory(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ items: CriticEvaluationResponseDto[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const { items, total } = await this.repository.findEvaluationHistory(userId, skip, limit);

    return {
      items: items.map(this.mapToResponse),
      total,
      page,
      limit,
    };
  }

  private mapToResponse(evalRecord: any): CriticEvaluationResponseDto {
    return {
      id: evalRecord.id,
      userId: evalRecord.userId,
      episodeId: evalRecord.episodeId,
      verdict: evalRecord.verdict,
      confidence: evalRecord.confidence,
      explanation: evalRecord.explanation,
      strengths: evalRecord.strengths,
      weaknesses: evalRecord.weaknesses,
      suggestedRuleChanges: (evalRecord.suggestedRuleChanges as any) || [],
      rawPrompt: evalRecord.rawPrompt,
      rawResponse: evalRecord.rawResponse,
      createdAt: evalRecord.createdAt.toISOString(),
    };
  }
}
