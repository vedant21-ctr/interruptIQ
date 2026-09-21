import {
  calculateFocusReportMetrics,
  evaluateShadowPolicy,
  FocusReport,
  inferFocusState,
  UserSettings,
} from '@interrupt-iq/shared';
import { BadRequestError, NotFoundError } from '../../errors/app-error';
import { ConnectionStatusDto } from './integration.interface';
import { IntegrationsRepository } from './integrations.repository';
import { GoogleCalendarAdapter } from './google/google.adapter';
import { SlackAdapter } from './slack/slack.adapter';

export class IntegrationsService {
  private repository: IntegrationsRepository;
  private slackAdapter: SlackAdapter;
  private googleAdapter: GoogleCalendarAdapter;

  constructor(repository: IntegrationsRepository) {
    this.repository = repository;
    this.slackAdapter = new SlackAdapter();
    this.googleAdapter = new GoogleCalendarAdapter();
  }

  async getAuthorizationUrl(userId: string, provider: 'slack' | 'google', state: string): Promise<string> {
    if (provider === 'slack') {
      return this.slackAdapter.getAuthorizationUrl(userId, state);
    }
    if (provider === 'google') {
      return this.googleAdapter.getAuthorizationUrl(userId, state);
    }
    throw new BadRequestError(`Unsupported integration provider: ${provider}`);
  }

  async handleOAuthCallback(
    userId: string,
    provider: 'slack' | 'google',
    code: string,
    redirectUri?: string
  ): Promise<ConnectionStatusDto> {
    let tokens;
    if (provider === 'slack') {
      tokens = await this.slackAdapter.exchangeAuthorizationCode(code, redirectUri);
    } else if (provider === 'google') {
      tokens = await this.googleAdapter.exchangeAuthorizationCode(code, redirectUri);
    } else {
      throw new BadRequestError(`Unsupported integration provider: ${provider}`);
    }

    const connection = await this.repository.upsertConnection({
      userId,
      provider,
      providerAccountId: tokens.providerAccountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      status: 'connected',
    });

    // Execute background historical sync immediately upon connection
    this.runHistoricalSync(userId, provider).catch((err) => {
      console.error(`[IntegrationsSync] Background sync error for ${provider}:`, err);
    });

    return {
      provider,
      status: 'connected',
      providerAccountId: connection.providerAccountId,
      scopes: connection.scopes,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() || null,
      createdAt: connection.createdAt.toISOString(),
    };
  }

  async getUserConnections(userId: string): Promise<ConnectionStatusDto[]> {
    return this.repository.findAllConnections(userId);
  }

  async pauseIntegration(userId: string, provider: 'slack' | 'google'): Promise<void> {
    const existing = await this.repository.findConnection(userId, provider);
    if (!existing) {
      throw new NotFoundError(`No connection found for provider ${provider}`);
    }
    await this.repository.updateConnectionStatus(userId, provider, 'paused');
  }

  async resumeIntegration(userId: string, provider: 'slack' | 'google'): Promise<void> {
    const existing = await this.repository.findConnection(userId, provider);
    if (!existing) {
      throw new NotFoundError(`No connection found for provider ${provider}`);
    }
    await this.repository.updateConnectionStatus(userId, provider, 'connected');
    this.runHistoricalSync(userId, provider).catch(() => {});
  }

  async disconnectIntegration(userId: string, provider: 'slack' | 'google'): Promise<void> {
    const existing = await this.repository.findConnection(userId, provider);
    if (existing) {
      if (provider === 'slack' && existing.accessToken) {
        await this.slackAdapter.revokeConnection(existing.accessToken);
      } else if (provider === 'google' && existing.accessToken) {
        await this.googleAdapter.revokeConnection(existing.accessToken);
      }
      await this.repository.deleteConnection(userId, provider);
    }
  }

  /**
   * Historical Synchronization Pipeline.
   * Fetches past 14 days of data, normalizes transiently, infers Focus State,
   * runs pure Shadow Policy, and persists normalized event/decision records
   * WITHOUT raw message text.
   */
  async runHistoricalSync(userId: string, provider: 'slack' | 'google'): Promise<NormalizedSyncResultSummary> {
    const connection = await this.repository.findConnection(userId, provider);
    if (!connection || connection.status === 'paused' || connection.status === 'disconnected') {
      return { provider, interruptionsCount: 0, calendarBlocksCount: 0 };
    }

    await this.repository.updateConnectionStatus(userId, provider, 'syncing');

    const end = new Date().toISOString();
    const start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const tokens = {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken || undefined,
      scopes: connection.scopes,
      providerAccountId: connection.providerAccountId || undefined,
    };

    try {
      let syncResult;
      if (provider === 'slack') {
        syncResult = await this.slackAdapter.fetchHistoricalData(userId, tokens, { start, end });
      } else {
        syncResult = await this.googleAdapter.fetchHistoricalData(userId, tokens, { start, end });
      }

      // Persist normalized interruptions idempotently (NO raw text stored)
      for (const item of syncResult.interruptions) {
        await this.repository.createNormalizedEvent({
          userId,
          title: `Slack message from ${item.senderId} (${item.channelType})`,
          body: `Mention: ${item.mentionType}, Urgency: ${item.hasUrgencySignal}`,
          sender: item.senderId,
          category: item.hasUrgencySignal ? 'urgent' : 'social',
          source: 'Slack',
          priority: item.hasUrgencySignal ? 'high' : 'medium',
          metadata: {
            providerEventId: item.id,
            channelType: item.channelType,
            mentionType: item.mentionType,
            slackPermalink: item.slackPermalink,
            hasUrgencySignal: item.hasUrgencySignal,
          },
          timestamp: new Date(item.receivedAt),
        });
      }

      await this.repository.updateConnectionStatus(userId, provider, 'connected');

      return {
        provider,
        interruptionsCount: syncResult.interruptions.length,
        calendarBlocksCount: syncResult.calendarBlocks.length,
      };
    } catch (err: any) {
      await this.repository.updateConnectionStatus(userId, provider, 'error', err.message);
      throw err;
    }
  }
}

export interface NormalizedSyncResultSummary {
  provider: 'slack' | 'google';
  interruptionsCount: number;
  calendarBlocksCount: number;
}
