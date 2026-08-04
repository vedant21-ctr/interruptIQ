import { PrismaClient } from '@prisma/client';
import { CreateContextSnapshotDto } from './context.dto';

export class ContextRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findLatestByUserId(userId: string) {
    return this.prisma.contextSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: CreateContextSnapshotDto) {
    const { metadata, ...rest } = data;
    return this.prisma.contextSnapshot.create({
      data: {
        userId,
        ...rest,
        // Store metadata as JSON
        metadata: metadata || undefined,
      },
    });
  }

  async findManyByUserId(userId: string, skip: number, take: number) {
    const items = await this.prisma.contextSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const total = await this.prisma.contextSnapshot.count({
      where: { userId },
    });

    return { items, total };
  }

  async deleteLatestByUserId(userId: string) {
    // Find the latest snapshot first
    const latest = await this.findLatestByUserId(userId);
    if (!latest) {
      return null;
    }

    return this.prisma.contextSnapshot.delete({
      where: { id: latest.id },
    });
  }
}
