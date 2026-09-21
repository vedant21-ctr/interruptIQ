import { PrismaClient } from '@prisma/client';
import { ConnectionStatusDto } from './integration.interface';

export class IntegrationsRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async upsertConnection(data: {
    userId: string;
    provider: 'slack' | 'google';
    providerAccountId?: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scopes: string[];
    status?: string;
  }): Promise<any> {
    return this.prisma.integrationConnection.upsert({
      where: {
        userId_provider: {
          userId: data.userId,
          provider: data.provider,
        },
      },
      create: {
        userId: data.userId,
        provider: data.provider,
        providerAccountId: data.providerAccountId || null,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || null,
        expiresAt: data.expiresAt || null,
        scopes: data.scopes,
        status: data.status || 'connected',
        lastSyncedAt: new Date(),
      },
      update: {
        providerAccountId: data.providerAccountId || undefined,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || undefined,
        expiresAt: data.expiresAt || undefined,
        scopes: data.scopes,
        status: data.status || 'connected',
        lastSyncedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async findConnection(userId: string, provider: 'slack' | 'google'): Promise<any> {
    return this.prisma.integrationConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });
  }

  async findAllConnections(userId: string): Promise<ConnectionStatusDto[]> {
    const connections = await this.prisma.integrationConnection.findMany({
      where: { userId },
    });

    return connections.map((c) => ({
      provider: c.provider as 'slack' | 'google',
      status: c.status as any,
      providerAccountId: c.providerAccountId,
      scopes: c.scopes,
      lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
      pausedAt: c.pausedAt ? c.pausedAt.toISOString() : null,
      errorMessage: c.errorMessage,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async updateConnectionStatus(
    userId: string,
    provider: 'slack' | 'google',
    status: 'connected' | 'syncing' | 'paused' | 'error' | 'disconnected',
    errorMessage?: string
  ): Promise<any> {
    return this.prisma.integrationConnection.update({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      data: {
        status,
        errorMessage: errorMessage || null,
        pausedAt: status === 'paused' ? new Date() : null,
        updatedAt: new Date(),
      },
    });
  }

  async deleteConnection(userId: string, provider: 'slack' | 'google'): Promise<any> {
    return this.prisma.integrationConnection.deleteMany({
      where: {
        userId,
        provider,
      },
    });
  }

  async createNormalizedEvent(data: {
    userId: string;
    title: string;
    body: string;
    sender: string;
    category: string;
    source: string;
    priority: string;
    payload?: any;
    metadata?: any;
    timestamp: Date;
  }): Promise<any> {
    // Idempotent deduplication check using providerEventId in metadata
    if (data.metadata?.providerEventId) {
      const existing = await this.prisma.event.findFirst({
        where: {
          userId: data.userId,
          metadata: {
            path: ['providerEventId'],
            equals: data.metadata.providerEventId,
          },
        },
      });
      if (existing) return existing;
    }

    return this.prisma.event.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body, // Safe normalized description (NO raw message text)
        sender: data.sender,
        category: data.category,
        source: data.source,
        priority: data.priority,
        payload: data.payload || null,
        metadata: data.metadata || null,
        timestamp: data.timestamp,
      },
    });
  }
}
