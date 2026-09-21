import { IntegrationAdapter, NormalizedSyncResult, OAuthTokens } from '../integration.interface';
import { normalizeGoogleCalendarEvent, RawGoogleCalendarEventPayload } from './google.normalizer';
import { env } from '../../../config/env';

export class GoogleCalendarAdapter implements IntegrationAdapter {
  readonly providerId = 'google' as const;

  getAuthorizationUrl(userId: string, state: string): string {
    const clientId = env.GOOGLE_CLIENT_ID || 'mock-google-client-id';
    const redirectUri = `${env.APP_BASE_URL}/api/v1/integrations/google/callback`;
    const scopes = ['https://www.googleapis.com/auth/calendar.events.readonly'].join(' ');

    return (
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(state)}`
    );
  }

  async exchangeAuthorizationCode(code: string, redirectUri?: string): Promise<OAuthTokens> {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      // Mock tokens for dev/test mode
      return {
        accessToken: `mock-google-access-token-${Date.now()}`,
        refreshToken: `mock-google-refresh-token-${Date.now()}`,
        scopes: ['https://www.googleapis.com/auth/calendar.events.readonly'],
        providerAccountId: 'user@example.com',
      };
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri || `${env.APP_BASE_URL}/api/v1/integrations/google/callback`,
      }),
    });

    const data = (await response.json()) as any;
    if (!data.access_token) {
      throw new Error(`Google OAuth code exchange failed: ${data.error_description || 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scopes: data.scope ? data.scope.split(' ') : [],
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        accessToken: `mock-refreshed-google-token-${Date.now()}`,
        scopes: ['https://www.googleapis.com/auth/calendar.events.readonly'],
      };
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
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
    if (!data.access_token) {
      throw new Error(`Google token refresh failed: ${data.error_description || 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      scopes: data.scope ? data.scope.split(' ') : [],
    };
  }

  async revokeConnection(accessToken: string): Promise<boolean> {
    if (accessToken.startsWith('mock-')) return true;

    try {
      const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return response.ok;
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
      const mockEvents: RawGoogleCalendarEventPayload[] = [
        {
          id: 'g-evt-1',
          summary: 'Sprint Planning Meeting',
          eventType: 'default',
          status: 'confirmed',
          start: { dateTime: timeRange.start },
          end: { dateTime: new Date(new Date(timeRange.start).getTime() + 3600000).toISOString() },
          attendees: [{ email: 'alice@corp.com' }, { email: 'bob@corp.com' }],
        },
        {
          id: 'g-evt-2',
          summary: 'Deep Focus Block',
          eventType: 'focusTime',
          status: 'confirmed',
          start: { dateTime: new Date(new Date(timeRange.end).getTime() - 7200000).toISOString() },
          end: { dateTime: timeRange.end },
          attendees: [],
        },
      ];

      const calendarBlocks = mockEvents
        .map((evt) => normalizeGoogleCalendarEvent(evt))
        .filter((b): b is NonNullable<typeof b> => b !== null);

      return {
        provider: 'google',
        interruptions: [],
        calendarBlocks,
      };
    }

    // Live Google Calendar REST API events.list execution
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', timeRange.start);
    url.searchParams.set('timeMax', timeRange.end);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    if (cursor) url.searchParams.set('pageToken', cursor);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    const data = (await response.json()) as any;
    if (data.error) {
      throw new Error(`Google Calendar events list failed: ${data.error.message}`);
    }

    const rawEvents: RawGoogleCalendarEventPayload[] = data.items || [];
    const calendarBlocks = rawEvents
      .map((evt) => normalizeGoogleCalendarEvent(evt))
      .filter((b): b is NonNullable<typeof b> => b !== null);

    const nextCursor = data.nextPageToken || undefined;

    return {
      provider: 'google',
      interruptions: [],
      calendarBlocks,
      nextCursor,
    };
  }
}
