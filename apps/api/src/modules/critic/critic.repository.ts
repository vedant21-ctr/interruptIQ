import { PrismaClient } from '@prisma/client';
import { CriticSuggestedRuleChangeDto } from './critic.dto';

export class CriticRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createEvaluation(data: {
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
  }) {
    return this.prisma.criticEvaluation.create({
      data: {
        userId: data.userId,
        episodeId: data.episodeId,
        verdict: data.verdict,
        confidence: data.confidence,
        explanation: data.explanation,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        suggestedRuleChanges: data.suggestedRuleChanges as any,
        rawPrompt: data.rawPrompt,
        rawResponse: data.rawResponse,
      },
    });
  }

  async findEvaluationById(id: string, userId: string) {
    return this.prisma.criticEvaluation.findFirst({
      where: { id, userId },
    });
  }

  async findEvaluationHistory(userId: string, skip: number, take: number) {
    const items = await this.prisma.criticEvaluation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const total = await this.prisma.criticEvaluation.count({
      where: { userId },
    });

    return { items, total };
  }
}
