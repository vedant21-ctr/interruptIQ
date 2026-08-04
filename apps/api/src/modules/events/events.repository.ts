import { PrismaClient } from '@prisma/client';
import { CreateEventDto, EventQueryDto } from './events.dto';

export class EventRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(userId: string, data: CreateEventDto) {
    const { payload, metadata, ...rest } = data;
    return this.prisma.event.create({
      data: {
        userId,
        ...rest,
        payload: payload || undefined,
        metadata: metadata || undefined,
      },
    });
  }

  async findManyByUserId(userId: string, query: EventQueryDto) {
    const { page, limit, source, category, priority, title, sender } = query;
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = { userId };

    // Filtering
    if (source) {
      where.source = source;
    }
    if (category) {
      where.category = category;
    }
    if (priority) {
      where.priority = priority;
    }

    // Searching
    if (title) {
      where.title = { contains: title, mode: 'insensitive' };
    }
    if (sender) {
      where.sender = { contains: sender, mode: 'insensitive' };
    }

    const items = await this.prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const total = await this.prisma.event.count({ where });

    return { items, total };
  }

  async findByIdAndUserId(id: string, userId: string) {
    return this.prisma.event.findFirst({
      where: { id, userId },
    });
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    return this.prisma.event.deleteMany({
      where: { id, userId },
    });
  }
}
