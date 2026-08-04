import { PrismaClient } from '@prisma/client';
import { MemorySearchDto } from './memory.dto';

export class MemoryRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findDecisionWithDetails(decisionId: string, userId: string) {
    return this.prisma.decision.findFirst({
      where: {
        id: decisionId,
        event: { userId },
      },
      include: {
        event: true,
        explanation: true,
        feedbacks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findEpisodeByDecisionId(decisionId: string) {
    return this.prisma.memoryEpisode.findUnique({
      where: { decisionId },
    });
  }

  async createEpisode(data: {
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
    metadata: any;
  }) {
    return this.prisma.memoryEpisode.create({
      data,
    });
  }

  async findEpisodeById(id: string, userId: string) {
    return this.prisma.memoryEpisode.findFirst({
      where: { id, userId },
    });
  }

  async searchEpisodes(userId: string, query: MemorySearchDto) {
    const {
      page,
      limit,
      decisionType,
      category,
      userAction,
      startDate,
      endDate,
      minConfidence,
      keyword,
    } = query;

    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = { userId };

    if (decisionType) {
      where.decisionType = decisionType;
    }

    if (category) {
      where.event = {
        category,
      };
    }

    if (userAction) {
      where.outcome = userAction;
    }

    if (minConfidence !== undefined) {
      where.confidence = {
        gte: minConfidence,
      };
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { explanation: { contains: keyword, mode: 'insensitive' } },
        { matchedRules: { has: keyword } },
      ];
    }

    const items = await this.prisma.memoryEpisode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const total = await this.prisma.memoryEpisode.count({ where });

    return { items, total };
  }

  async updateEpisodeEmbedding(id: string, embedding: number[], version: string) {
    return this.prisma.memoryEpisode.update({
      where: { id },
      data: {
        embedding,
        embeddingVersion: version,
        embeddedAt: new Date(),
      },
    });
  }

  async findEpisodesNeedingEmbedding(userId: string, version: string) {
    return this.prisma.memoryEpisode.findMany({
      where: {
        userId,
        OR: [
          { embeddingVersion: null },
          { embeddingVersion: { not: version } },
          { embedding: { equals: [] } },
        ],
      },
      include: {
        event: true,
        contextSnapshot: true,
      },
    });
  }
}
