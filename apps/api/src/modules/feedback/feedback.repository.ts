import { PrismaClient } from '@prisma/client';

export class FeedbackRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findDecisionById(decisionId: string, userId: string) {
    return this.prisma.decision.findFirst({
      where: {
        id: decisionId,
        event: { userId },
      },
    });
  }

  async createFeedback(data: {
    decisionId: string;
    originalDecision: string;
    userAction: string;
    comment: string | null;
  }) {
    return this.prisma.feedback.create({
      data,
    });
  }

  async findFeedbackById(id: string, userId: string) {
    return this.prisma.feedback.findFirst({
      where: {
        id,
        decision: {
          event: { userId },
        },
      },
    });
  }

  async findManyByUserId(userId: string) {
    return this.prisma.feedback.findMany({
      where: {
        decision: {
          event: { userId },
        },
      },
    });
  }
}
