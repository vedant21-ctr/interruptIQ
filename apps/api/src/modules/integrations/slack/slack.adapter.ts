import crypto from 'crypto';
import { IntegrationAdapter, NormalizedSyncResult, OAuthTokens } from '../integration.interface';
import { normalizeSlackMessage, RawSlackMessagePayload } from './slack.normalizer';
import { env } from '../../../config/env';

export class SlackAdapter implements IntegrationAdapter {
  readonly providerId = 'slack' as const;

  getAuthorizationUrl(userId: string, state: string): string {
    const clientId = env.SLACK_CLIENT_ID || 'mock-slack-client-id';
    const redirectUri = `${env.APP_BASE_URL}/api/v1/integrations/slack/callback`;
    const userScopes = [
      'channels:history',
      'groups:history',
      'im:history',
      'mpim:history',
      'users:read',
    ].join(',');

    return (
      `https://slack.com/oauth/v2/authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&user_scope=${encodeURIComponent(userScopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`
    );
  }

  async exchangeAuthorizationCode(code: string, redirectUri?: string): Promise<OAuthTokens> {
    const clientId = env.SLACK_CLIENT_ID;
    const clientSecret = env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      // Return safe mock tokens for testing/development environments
      return {
        accessToken: `mock-slack-access-token-${Date.now()}`,
        scopes: ['channels:history', 'groups:history', 'im:history', 'mpim:history', 'users:read'],
        providerAccountId: 'U12345678',
      };
    }

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri || `${env.APP_BASE_URL}/api/v1/integrations/slack/callback`,
      }),
    });

    const data = (await response.json()) as any;
    if (!data.ok) {
      throw new Error(`Slack OAuth code exchange failed: ${data.error || 'Unknown error'}`);
    }

    const authedUser = data.authed_user || {};
    const scopes = authedUser.scope ? authedUser.scope.split(',') : [];

    return {
      accessToken: authedUser.access_token || data.access_token,
      refreshToken: authedUser.refresh_token,
      expiresIn: authedUser.expires_in,
      scopes,
      providerAccountId: authedUser.id || data.team?.id,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = env.SLACK_CLIENT_ID;
    const clientSecret = env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        accessToken: `mock-refreshed-slack-token-${Date.now()}`,
        scopes: ['channels:history', 'groups:history', 'im:history', 'mpim:history', 'users:read'],
      };
    }

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = (await response.json()) as any;
    if (!data.ok) {
      throw new Error(`Slack token refresh failed: ${data.error || 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scopes: data.scope ? data.scope.split(',') : [],
    };
  }

  async revokeConnection(accessToken: string): Promise<boolean> {
    if (accessToken.startsWith('mock-')) return true;

    try {
      const response = await fetch('https://slack.com/api/auth.revoke', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const data = (await response.json()) as any;
      return !!data.ok;
    } catch {
      return false;
    }
  }

  async fetchHistoricalData(
    userId: string,
    tokens: OAuthTokens,
    timeRange: { start: string; end: string },
    cursor?: string
  ): Promise<NormalizedSyncResult> {
    // If mock tokens, return normalized fixture dataset
    if (tokens.accessToken.startsWith('mock-')) {
      const mockPayloads: RawSlackMessagePayload[] = [
        {
          ts: `${Math.floor(new Date(timeRange.start).getTime() / 1000)}.000100`,
          user: 'U_DEV_ALICE',
          text: 'Hey @channel, deployment pipeline is red!',
          channel: 'C_DEV',
          channel_type: 'public',
        },
        {
          ts: `${Math.floor(new Date(timeRange.end).getTime() / 1000 - 3600)}.000200`,
          user: 'U_PM_BOB',
          text: 'Can you review this ASAP? Urgent blocker!',
          channel: 'D_DIRECT',
          channel_type: 'im',
        },
      ];

      const interruptions = mockPayloads.map((p) =>
        normalizeSlackMessage(p, userId, tokens.providerAccountId)
      );

      return {
        provider: 'slack',
        interruptions,
        calendarBlocks: [],
      };
    }

    // Live Slack Web API conversations.history execution
    const oldest = (new Date(timeRange.start).getTime() / 1000).toString();
    const latest = (new Date(timeRange.end).getTime() / 1000).toString();

    const url = new URL('https://slack.com/api/conversations.history');
    url.searchParams.set('channel', 'C_GENERAL');
    url.searchParams.set('oldest', oldest);
    url.searchParams.set('latest', latest);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    const data = (await response.json()) as any;
    if (!data.ok) {
      throw new Error(`Slack history fetch error: ${data.error}`);
    }

    const rawMessages: RawSlackMessagePayload[] = data.messages || [];
    const interruptions = rawMessages.map((msg) =>
      normalizeSlackMessage(msg, userId, tokens.providerAccountId)
    );

    const nextCursor = data.response_metadata?.next_cursor || undefined;

    return {
      provider: 'slack',
      interruptions,
      calendarBlocks: [],
      nextCursor,
    };
  }

  /**
   * Verifies Slack Events API Webhook HMAC-SHA256 signature.
   */
  static verifySlackSignature(
    signingSecret: string,
    signature: string,
    timestamp: string,
    rawBody: string
  ): boolean {
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (parseInt(timestamp, 10) < fiveMinutesAgo) {
      return false; // Prevent replay attacks
    }

    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const mySignature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const bufA = Buffer.from(mySignature);
    const bufB = Buffer.from(signature);

    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }
}
