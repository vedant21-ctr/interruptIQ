import { DerivedCalendarBlock, InterruptionRecord } from '@interrupt-iq/shared';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: Date;
  scopes: string[];
  providerAccountId?: string;
}

export interface ConnectionStatusDto {
  provider: 'slack' | 'google';
  status: 'connected' | 'syncing' | 'paused' | 'error' | 'disconnected';
  providerAccountId?: string | null;
  scopes: string[];
  lastSyncedAt?: string | null;
  pausedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface NormalizedSyncResult {
  provider: 'slack' | 'google';
  interruptions: InterruptionRecord[];
  calendarBlocks: DerivedCalendarBlock[];
  nextCursor?: string;
}

export interface IntegrationAdapter {
  providerId: 'slack' | 'google';
  getAuthorizationUrl(userId: string, state: string): string;
  exchangeAuthorizationCode(code: string, redirectUri?: string): Promise<OAuthTokens>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;
  revokeConnection(accessToken: string): Promise<boolean>;
  fetchHistoricalData(
    userId: string,
    tokens: OAuthTokens,
    timeRange: { start: string; end: string },
    cursor?: string
  ): Promise<NormalizedSyncResult>;
}
