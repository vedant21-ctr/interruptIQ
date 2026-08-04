import { PrismaClient } from '@prisma/client';

export class DecisionRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findEventAndLatestContext(eventId: string, userId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
    });

    if (!event) return null;

    const latestContext = await this.prisma.contextSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return { event, latestContext };
  }

  async findActiveRules(userId: string) {
    return this.prisma.rule.findMany({
      where: { userId, isActive: true, deletedAt: null },
    });
  }

  async createDecision(data: {
    eventId: string;
    contextSnapshotId: string | null;
    decision: string;
    reason: string;
    confidence: number;
    signalsUsed: string[];
    explanationNarrative: string;
  }) {
    const { explanationNarrative, ...decisionData } = data;

    return this.prisma.$transaction(async (tx) => {
      const decision = await tx.decision.create({
        data: {
          ...decisionData,
        },
      });

      const explanation = await tx.decisionExplanation.create({
        data: {
          decisionId: decision.id,
          narrative: explanationNarrative,
          rulesAttribution: 1.0,
          semanticsAttribution: 0.0,
          mlAttribution: 0.0,
          historyAttribution: 0.0,
        },
      });

      return {
        ...decision,
        explanation,
      };
    });
  }

  async findByIdAndUserId(id: string, userId: string) {
    return this.prisma.decision.findFirst({
      where: {
        id,
        event: { userId },
      },
      include: {
        explanation: true,
        event: true,
      },
    });
  }

  async findManyByUserId(userId: string, skip: number, take: number) {
    const items = await this.prisma.decision.findMany({
      where: {
        event: { userId },
      },
      include: {
        explanation: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const total = await this.prisma.decision.count({
      where: {
        event: { userId },
      },
    });

    return { items, total };
  }
}
