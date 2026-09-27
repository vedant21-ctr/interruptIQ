import { PrismaClient } from '@prisma/client';

export class FocusReportRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getCalendarBlocks(userId: string, startAt: Date, endAt: Date) {
    return this.prisma.calendarBlock.findMany({
      where: {
        userId,
        startAt: { lte: endAt },
        endAt: { gte: startAt },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async getEvents(userId: string, startAt: Date, endAt: Date) {
    return this.prisma.event.findMany({
      where: {
        userId,
        source: 'Slack',
        timestamp: {
          gte: startAt,
          lte: endAt,
        },
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  async upsertReview(data: {
    userId: string;
    reportId: string;
    interruptionId: string;
    policyVersion?: string;
    verdict: string;
    comment?: string;
    reasonCode?: string;
    focusState?: string;
    outcome?: string;
    channelType?: string;
    mentionType?: string;
    hasUrgencySignal?: boolean;
    harmCategory?: string;
  }) {
    const policyVersion = data.policyVersion || 'shadow-v0.1';
    return this.prisma.focusReportReview.upsert({
      where: {
        userId_interruptionId_policyVersion: {
          userId: data.userId,
          interruptionId: data.interruptionId,
          policyVersion,
        },
      },
      create: {
        userId: data.userId,
        reportId: data.reportId,
        interruptionId: data.interruptionId,
        policyVersion,
        verdict: data.verdict,
        comment: data.comment || null,
        reasonCode: data.reasonCode || null,
        focusState: data.focusState || null,
        outcome: data.outcome || null,
        channelType: data.channelType || null,
        mentionType: data.mentionType || null,
        hasUrgencySignal: data.hasUrgencySignal ?? null,
        harmCategory: data.harmCategory || null,
      },
      update: {
        reportId: data.reportId,
        verdict: data.verdict,
        comment: data.comment || null,
        reasonCode: data.reasonCode || null,
        focusState: data.focusState || null,
        outcome: data.outcome || null,
        channelType: data.channelType || null,
        mentionType: data.mentionType || null,
        hasUrgencySignal: data.hasUrgencySignal ?? null,
        harmCategory: data.harmCategory || null,
        updatedAt: new Date(),
      },
    });
  }

  async findUserReviews(userId: string, policyVersion: string = 'shadow-v0.1') {
    return this.prisma.focusReportReview.findMany({
      where: {
        userId,
        policyVersion,
      },
    });
  }

  async findReviewsForPeriod(
    userId: string,
    startAt?: Date,
    endAt?: Date,
    policyVersion: string = 'shadow-v0.1'
  ) {
    const where: any = {
      userId,
      policyVersion,
    };

    if (startAt || endAt) {
      where.createdAt = {};
      if (startAt) where.createdAt.gte = startAt;
      if (endAt) where.createdAt.lte = endAt;
    }

    return this.prisma.focusReportReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findReviewByUserAndInterruption(
    userId: string,
    interruptionId: string,
    policyVersion: string = 'shadow-v0.1'
  ) {
    return this.prisma.focusReportReview.findUnique({
      where: {
        userId_interruptionId_policyVersion: {
          userId,
          interruptionId,
          policyVersion,
        },
      },
    });
  }

  async findEventById(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
    });
  }
}
