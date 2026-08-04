import { PrismaClient } from '@prisma/client';
import { MemoryRetrievalDto } from '../memory/retrieval.dto';

export class RetrievalRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findCandidates(userId: string, query: MemoryRetrievalDto) {
    const { minConfidence, maxConfidence, startDate, endDate, keyword } = query;

    const where: any = { userId };

    // Confidence ranges (hard filter)
    if (minConfidence !== undefined && minConfidence !== null) {
      where.confidence = { ...where.confidence, gte: minConfidence };
    }
    if (maxConfidence !== undefined && maxConfidence !== null) {
      where.confidence = { ...where.confidence, lte: maxConfidence };
    }

    // Date ranges (hard filter)
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Keyword search in explanation or matched rules (hard filter)
    if (keyword) {
      where.OR = [
        { explanation: { contains: keyword, mode: 'insensitive' } },
        { matchedRules: { has: keyword } },
      ];
    }

    // Join/Include event details to evaluate category/source in memory/ranking
    return this.prisma.memoryEpisode.findMany({
      where,
      include: {
        event: true,
        contextSnapshot: true,
      },
    });
  }
}
