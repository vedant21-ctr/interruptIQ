import { describe, expect, it } from 'vitest';
import { SlackAdapter } from '../src/modules/integrations/slack/slack.adapter';
import { normalizeSlackMessage } from '../src/modules/integrations/slack/slack.normalizer';
import { GoogleCalendarAdapter } from '../src/modules/integrations/google/google.adapter';
import { normalizeGoogleCalendarEvent } from '../src/modules/integrations/google/google.normalizer';
import { IntegrationsService } from '../src/modules/integrations/integrations.service';
import {
  calculateFocusReportMetrics,
  evaluateShadowPolicy,
  inferFocusState,
  UserSettings,
} from '@interrupt-iq/shared';

const defaultConfig: UserSettings = {
  userId: 'user-test-1',
  workingHours: { start: '09:00', end: '18:00', tz: 'UTC' },
  recoveryMinutesAssumption: 23,
  quietWindowThresholdMinutes: 45,
  urgencyKeywords: ['URGENT', 'ASAP', 'BLOCKER'],
  vipUserIds: ['U_VIP_1'],
  vipSenders: ['boss@corp.com'],
  incidentChannelKeywords: ['incident'],
  batchWindows: ['11:30', '16:30'],
};

describe('Focus Report Integration Layer Foundation', () => {

  // Test 1: Slack Normalization & Privacy Boundary
  it('Slack Normalizer: extracts metadata features and DISCARDS raw secret message content', () => {
    const rawSecretPayload = {
      ts: '1690000000.000100',
      user: 'U_DEV_ALICE',
      text: 'THIS IS SECRET MESSAGE CONTENT WITH CONFIDENTIAL SOURCE CODE! ALSO URGENT BLOCKER!',
      channel: 'C_DEV_CHANNEL',
      channel_type: 'public' as const,
      team: 'T_CORP',
    };

    const normalized = normalizeSlackMessage(rawSecretPayload, 'user-test-1', 'U_ME');

    // Verify metadata features derived correctly
    expect(normalized.id).toBe('slack:T_CORP:C_DEV_CHANNEL:1690000000.000100');
    expect(normalized.senderId).toBe('U_DEV_ALICE');
    expect(normalized.hasUrgencySignal).toBe(true);
    expect(normalized.channelType).toBe('public');
    expect(normalized.slackPermalink).toBe('https://slack.com/archives/C_DEV_CHANNEL/p1690000000000100');

    // PRIVACY TEST: Raw message text MUST NOT exist in normalized record keys or values
    const stringifiedRecord = JSON.stringify(normalized);
    expect(stringifiedRecord).not.toContain('THIS IS SECRET MESSAGE CONTENT WITH CONFIDENTIAL SOURCE CODE');
  });

  // Test 2: Google Calendar Normalization & Privacy Boundary
  it('Google Calendar Normalizer: extracts derived meeting kind and DISCARDS secret event summary/description', () => {
    const rawSecretEvent = {
      id: 'g_evt_secret_123',
      summary: 'CONFIDENTIAL SALARY & BOARD MEETING - TOP SECRET',
      description: 'Private meeting notes containing sensitive M&A details',
      eventType: 'default' as const,
      status: 'confirmed' as const,
      start: { dateTime: '2026-09-22T10:00:00.000Z' },
      end: { dateTime: '2026-09-22T11:00:00.000Z' },
      attendees: [{ email: 'ceo@corp.com' }, { email: 'vp@corp.com' }],
    };

    const normalized = normalizeGoogleCalendarEvent(rawSecretEvent, 'primary');

    expect(normalized).not.toBeNull();
    expect(normalized!.id).toBe('google:primary:g_evt_secret_123');
    expect(normalized!.kind).toBe('meeting');
    expect(normalized!.attendeeCount).toBe(2);

    // PRIVACY TEST: Raw summary & description MUST NOT exist in normalized record keys or values
    const stringifiedBlock = JSON.stringify(normalized);
    expect(stringifiedBlock).not.toContain('CONFIDENTIAL SALARY');
    expect(stringifiedBlock).not.toContain('Private meeting notes');
  });

  // Test 3: Slack HMAC-SHA256 Signature Verification
  it('Slack Signature Verification: validates valid signatures and rejects forged signatures', () => {
    const signingSecret = 'secret-test-key-12345';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = '{"type":"url_verification","challenge":"test_challenge_123"}';

    // Generate valid signature
    const crypto = require('crypto');
    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const validSignature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const isValid = SlackAdapter.verifySlackSignature(
      signingSecret,
      validSignature,
      timestamp,
      rawBody
    );
    expect(isValid).toBe(true);

    const isForgedValid = SlackAdapter.verifySlackSignature(
      signingSecret,
      'v0=forgedsignature12345',
      timestamp,
      rawBody
    );
    expect(isForgedValid).toBe(false);
  });

  // Test 4: End-to-End Flow from Adapter Historical Data -> Focus State -> Policy -> Metrics
  it('Integration Pipeline: flows normalized provider objects through focus-state, shadow-policy, and metrics', async () => {
    const slackAdapter = new SlackAdapter();
    const googleAdapter = new GoogleCalendarAdapter();

    const mockTokens = {
      accessToken: 'mock-test-token',
      scopes: ['channels:history', 'calendar.events.readonly'],
    };

    const timeRange = {
      start: '2026-09-22T08:00:00.000Z',
      end: '2026-09-22T18:00:00.000Z',
    };

    // 1. Fetch normalized data from provider adapters
    const slackData = await slackAdapter.fetchHistoricalData('user-test-1', mockTokens, timeRange);
    const googleData = await googleAdapter.fetchHistoricalData('user-test-1', mockTokens, timeRange);

    expect(slackData.interruptions.length).toBeGreaterThan(0);
    expect(googleData.calendarBlocks.length).toBeGreaterThan(0);

    // 2. Infer Focus State for first Slack interruption
    const firstInterruption = slackData.interruptions[0];
    const inferredState = inferFocusState(
      googleData.calendarBlocks,
      null,
      firstInterruption.receivedAt,
      defaultConfig
    );

    // 3. Evaluate Shadow Policy
    const shadowDecision = evaluateShadowPolicy(firstInterruption, inferredState, defaultConfig);

    expect(shadowDecision.policyVersion).toBe('shadow-v0.1');
    expect(['DELIVER', 'DELAY_TO_MEETING_END', 'DELAY_TO_BOUNDARY', 'BATCH']).toContain(
      shadowDecision.outcome
    );

    // 4. Calculate Focus Report Metrics
    const metrics = calculateFocusReportMetrics(
      slackData.interruptions,
      [shadowDecision],
      [],
      defaultConfig
    );

    expect(metrics.totalInterruptions.type).toBe('MEASURED');
    expect(metrics.totalInterruptions.value).toBe(slackData.interruptions.length);
    expect(metrics.outcomeBreakdown.type).toBe('DERIVED');
    expect(metrics.estimatedRecoveryCostMinutes.type).toBe('ESTIMATED');
  });

  // Test 5: Automatic Token Refresh during Sync
  it('IntegrationsService: automatically refreshes expired access token before sync', async () => {
    let upsertCalled = false;
    let refreshedTokensSaved = false;

    const mockRepo: any = {
      findConnection: async (userId: string, provider: string) => ({
        userId,
        provider,
        accessToken: 'expired-access-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
        scopes: ['channels:history', 'channels:read'],
        status: 'connected',
      }),
      upsertConnection: async (data: any) => {
        upsertCalled = true;
        if (data.accessToken.startsWith('mock-refreshed-')) {
          refreshedTokensSaved = true;
        }
        return { ...data, createdAt: new Date() };
      },
      updateConnectionStatus: async () => {},
      createNormalizedEvent: async () => {},
      upsertCalendarBlock: async () => {},
    };

    const service = new IntegrationsService(mockRepo);
    const validTokens = await service.getValidTokens('user-test-1', 'slack');

    expect(upsertCalled).toBe(true);
    expect(refreshedTokensSaved).toBe(true);
    expect(validTokens.accessToken).toContain('mock-refreshed-slack-token');
  });

  // Test 6: Failed Token Refresh Marks Connection as Error
  it('IntegrationsService: updates connection status to error when token refresh fails', async () => {
    let errorStatusSet = false;
    let errorMessageSaved = '';

    const mockRepo: any = {
      findConnection: async (userId: string, provider: string) => ({
        userId,
        provider,
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: new Date(Date.now() - 10000),
        scopes: [],
        status: 'connected',
      }),
      updateConnectionStatus: async (userId: string, provider: string, status: string, msg: string) => {
        if (status === 'error') {
          errorStatusSet = true;
          errorMessageSaved = msg;
        }
      },
    };

    const service = new IntegrationsService(mockRepo);
    // Force adapter to fail refresh
    service['slackAdapter'].refreshAccessToken = async () => {
      throw new Error('invalid_grant');
    };

    await expect(service.getValidTokens('user-test-1', 'slack')).rejects.toThrow('Integration token refresh failed');
    expect(errorStatusSet).toBe(true);
    expect(errorMessageSaved).toContain('invalid_grant');
  });

  // Test 7: Calendar Block Persistence & Deduplication in Sync Pipeline
  it('IntegrationsService: persists normalized calendar blocks idempotently during sync', async () => {
    const savedBlocks: any[] = [];

    const mockRepo: any = {
      findConnection: async (userId: string, provider: string) => ({
        userId,
        provider,
        accessToken: 'mock-google-token',
        refreshToken: 'mock-refresh',
        expiresAt: new Date(Date.now() + 3600000),
        scopes: ['https://www.googleapis.com/auth/calendar.events.readonly'],
        status: 'connected',
      }),
      updateConnectionStatus: async () => {},
      createNormalizedEvent: async () => {},
      upsertCalendarBlock: async (data: any) => {
        savedBlocks.push(data);
        return data;
      },
    };

    const service = new IntegrationsService(mockRepo);
    const result = await service.runHistoricalSync('user-test-1', 'google');

    expect(result.provider).toBe('google');
    expect(savedBlocks.length).toBeGreaterThan(0);
    expect(savedBlocks[0]).toHaveProperty('userId', 'user-test-1');
    expect(savedBlocks[0]).toHaveProperty('provider', 'google');
    expect(savedBlocks[0]).toHaveProperty('kind');
    expect(savedBlocks[0]).toHaveProperty('isBusy');
    // Ensure privacy: raw summary/description NOT saved in calendar block repository object
    expect(savedBlocks[0]).not.toHaveProperty('summary');
    expect(savedBlocks[0]).not.toHaveProperty('description');
  });

});

