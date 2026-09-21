import { describe, expect, it } from 'vitest';
import {
  evaluateShadowPolicy,
  inferFocusState,
  runReplaySimulator,
  DecisionReview,
  DerivedCalendarBlock,
  InterruptionRecord,
  UserSettings,
} from '../src/index';

const defaultConfig: UserSettings = {
  userId: 'user-123',
  workingHours: { start: '09:00', end: '18:00', tz: 'UTC' },
  recoveryMinutesAssumption: 23,
  quietWindowThresholdMinutes: 45,
  urgencyKeywords: ['urgent', 'asap', 'blocker', 'critical'],
  vipUserIds: ['user-vip-99'],
  vipSenders: ['boss@company.com'],
  incidentChannelKeywords: ['incident', 'oncall'],
  batchWindows: ['11:30', '16:30'],
};

describe('Focus Report v0 Engine (Pure Functions)', () => {

  // Scenario A: User in meeting, ordinary Slack DM arrives -> DELAY_TO_MEETING_END
  it('Scenario A: delays ordinary Slack DM during meeting to meeting end', () => {
    const calendar: DerivedCalendarBlock[] = [
      {
        id: 'cal-1',
        start: '2026-09-22T10:00:00.000Z',
        end: '2026-09-22T11:00:00.000Z',
        kind: 'meeting',
        isBusy: true,
        attendeeCount: 3,
      },
    ];

    const record: InterruptionRecord = {
      id: 'msg-1',
      userId: 'user-123',
      receivedAt: '2026-09-22T10:15:00.000Z',
      source: 'slack',
      channelType: 'dm',
      mentionType: 'direct',
      senderId: 'user-colleague',
      senderTier: 'other',
      hasUrgencySignal: false,
      slackPermalink: 'https://slack.com/archives/C1/p1',
    };

    const state = inferFocusState(calendar, null, record.receivedAt, defaultConfig);
    expect(state).toBe('meeting');

    const decision = evaluateShadowPolicy(record, state, defaultConfig, {
      meetingEndAt: '2026-09-22T11:00:00.000Z',
    });

    expect(decision.outcome).toBe('DELAY_TO_MEETING_END');
    expect(decision.reasonCode).toBe('MEETING_DELAY_TO_END');
    expect(decision.wouldDeliverAt).toBe('2026-09-22T11:00:00.000Z');
  });

  // Scenario B: Configured VIP DM during focus block -> DELIVER
  it('Scenario B: delivers VIP DM immediately even during focus block', () => {
    const record: InterruptionRecord = {
      id: 'msg-vip',
      userId: 'user-123',
      receivedAt: '2026-09-22T14:00:00.000Z',
      source: 'slack',
      channelType: 'dm',
      mentionType: 'direct',
      senderId: 'user-vip-99', // VIP ID
      senderTier: 'vip',
      hasUrgencySignal: false,
      slackPermalink: 'https://slack.com/archives/C1/p2',
    };

    const decision = evaluateShadowPolicy(record, 'focus_block', defaultConfig);
    expect(decision.outcome).toBe('DELIVER');
    expect(decision.reasonCode).toBe('NEVER_SUPPRESS_VIP');
  });

  // Scenario C: @channel during quiet/focus window -> BATCH
  it('Scenario C: batches @channel broadcasts during focus state', () => {
    const record: InterruptionRecord = {
      id: 'msg-broadcast',
      userId: 'user-123',
      receivedAt: '2026-09-22T14:30:00.000Z',
      source: 'slack',
      channelType: 'public',
      mentionType: 'channel',
      senderId: 'user-announcer',
      senderTier: 'other',
      hasUrgencySignal: false,
      slackPermalink: 'https://slack.com/archives/C1/p3',
    };

    const decision = evaluateShadowPolicy(record, 'quiet_window', defaultConfig);
    expect(decision.outcome).toBe('BATCH');
    expect(decision.reasonCode).toBe('FOCUS_BLOCK_BATCH_CHANNEL');
  });

  // Scenario D: Direct mention with trusted urgency signal -> DELIVER
  it('Scenario D: delivers direct mention immediately if urgency signal present', () => {
    const record: InterruptionRecord = {
      id: 'msg-urgent',
      userId: 'user-123',
      receivedAt: '2026-09-22T15:00:00.000Z',
      source: 'slack',
      channelType: 'dm',
      mentionType: 'direct',
      senderId: 'user-dev',
      senderTier: 'other',
      hasUrgencySignal: true, // Urgency signal detected
      slackPermalink: 'https://slack.com/archives/C1/p4',
    };

    const decision = evaluateShadowPolicy(record, 'focus_block', defaultConfig);
    expect(decision.outcome).toBe('DELIVER');
    expect(decision.reasonCode).toBe('DIRECT_MENTION_URGENT');
  });

  // Scenario E: Ordinary thread reply during focus state -> DELAY_TO_BOUNDARY
  it('Scenario E: delays thread reply to focus boundary during focus state', () => {
    const record: InterruptionRecord = {
      id: 'msg-reply',
      userId: 'user-123',
      receivedAt: '2026-09-22T15:15:00.000Z',
      source: 'slack',
      channelType: 'public',
      mentionType: 'thread_reply',
      senderId: 'user-peer',
      senderTier: 'other',
      hasUrgencySignal: false,
      slackPermalink: 'https://slack.com/archives/C1/p5',
    };

    const decision = evaluateShadowPolicy(record, 'focus_block', defaultConfig);
    expect(decision.outcome).toBe('DELAY_TO_BOUNDARY');
    expect(decision.reasonCode).toBe('FOCUS_BLOCK_DELAY_BOUNDARY');
  });

  // Scenario F: Available state -> DELIVER
  it('Scenario F: delivers all notifications during available focus state', () => {
    const record: InterruptionRecord = {
      id: 'msg-avail',
      userId: 'user-123',
      receivedAt: '2026-09-22T11:30:00.000Z',
      source: 'slack',
      channelType: 'public',
      mentionType: 'none',
      senderId: 'user-peer',
      senderTier: 'other',
      hasUrgencySignal: false,
      slackPermalink: 'https://slack.com/archives/C1/p6',
    };

    const decision = evaluateShadowPolicy(record, 'available', defaultConfig);
    expect(decision.outcome).toBe('DELIVER');
    expect(decision.reasonCode).toBe('STATE_AVAILABLE');
  });

  // Scenario G: Replay simulator generates full report metrics
  it('Scenario G: generates full Focus Report metrics over multiple timeline events', () => {
    const calendar: DerivedCalendarBlock[] = [
      {
        id: 'cal-m1',
        start: '2026-09-22T10:00:00.000Z',
        end: '2026-09-22T11:00:00.000Z',
        kind: 'meeting',
        isBusy: true,
        attendeeCount: 2,
      },
      {
        id: 'cal-f1',
        start: '2026-09-22T14:00:00.000Z',
        end: '2026-09-22T16:00:00.000Z',
        kind: 'focus_block',
        isBusy: true,
        attendeeCount: 1,
      },
    ];

    const records: InterruptionRecord[] = [
      {
        id: 'r1',
        userId: 'user-123',
        receivedAt: '2026-09-22T09:30:00.000Z',
        source: 'slack',
        channelType: 'public',
        mentionType: 'none',
        senderId: 's1',
        senderTier: 'other',
        hasUrgencySignal: false,
        slackPermalink: 'https://slack.com/archives/C1/p10',
      },
      {
        id: 'r2',
        userId: 'user-123',
        receivedAt: '2026-09-22T10:20:00.000Z',
        source: 'slack',
        channelType: 'dm',
        mentionType: 'direct',
        senderId: 's2',
        senderTier: 'other',
        hasUrgencySignal: false,
        slackPermalink: 'https://slack.com/archives/C1/p11',
      },
      {
        id: 'r3',
        userId: 'user-123',
        receivedAt: '2026-09-22T14:30:00.000Z',
        source: 'slack',
        channelType: 'public',
        mentionType: 'channel',
        senderId: 's3',
        senderTier: 'other',
        hasUrgencySignal: false,
        slackPermalink: 'https://slack.com/archives/C1/p12',
      },
    ];

    const report = runReplaySimulator(calendar, records, [], defaultConfig);

    expect(report.metrics.totalInterruptions.value).toBe(3);
    expect(report.metrics.outcomeBreakdown.value.DELIVER).toBe(1);
    expect(report.metrics.outcomeBreakdown.value.DELAY_TO_MEETING_END).toBe(1);
    expect(report.metrics.outcomeBreakdown.value.BATCH).toBe(1);
    expect(report.metrics.estimatedAvoidableShare.value).toBeGreaterThan(0);
    expect(report.sampledReviewQueue.length).toBe(2);
  });

  // Scenario H: User reviews one delayed event as "hurt" -> adjusted metrics change
  it('Scenario H: adjusts avoidable share when user reviews a delayed event as hurt', () => {
    const records: InterruptionRecord[] = [
      {
        id: 'r1',
        userId: 'user-123',
        receivedAt: '2026-09-22T14:30:00.000Z',
        source: 'slack',
        channelType: 'public',
        mentionType: 'thread_reply',
        senderId: 's1',
        senderTier: 'other',
        hasUrgencySignal: false,
        slackPermalink: 'https://slack.com/archives/C1/p13',
      },
    ];

    const calendar: DerivedCalendarBlock[] = [
      {
        id: 'f1',
        start: '2026-09-22T14:00:00.000Z',
        end: '2026-09-22T16:00:00.000Z',
        kind: 'focus_block',
        isBusy: true,
        attendeeCount: 1,
      },
    ];

    // Initial report without review
    const report1 = runReplaySimulator(calendar, records, [], defaultConfig);
    expect(report1.metrics.estimatedAvoidableShare.value).toBe(1.0);
    expect(report1.metrics.adjustedAvoidableShare.value).toBe(1.0);

    // Add user review marking decision as "hurt"
    const reviews: DecisionReview[] = [
      {
        id: 'rev-1',
        interruptionId: 'r1',
        userId: 'user-123',
        policyVersion: 'shadow-v0.1',
        verdict: 'hurt',
        comment: 'This was an active deployment blocker!',
        createdAt: '2026-09-22T17:00:00.000Z',
      },
    ];

    const report2 = runReplaySimulator(calendar, records, reviews, defaultConfig);
    expect(report2.metrics.criticalDelayRate.value).toBe(1.0);
    expect(report2.metrics.adjustedAvoidableShare.value).toBe(0.0);
  });

  // Scenario I: Pure Function Determinism (Identical inputs -> Identical outputs)
  it('Scenario I: guarantees 100% policy determinism for identical inputs', () => {
    const record: InterruptionRecord = {
      id: 'msg-det',
      userId: 'user-123',
      receivedAt: '2026-09-22T10:15:00.000Z',
      source: 'slack',
      channelType: 'dm',
      mentionType: 'direct',
      senderId: 's1',
      senderTier: 'other',
      hasUrgencySignal: false,
      slackPermalink: 'https://slack.com/archives/C1/p14',
    };

    const d1 = evaluateShadowPolicy(record, 'meeting', defaultConfig);
    const d2 = evaluateShadowPolicy(record, 'meeting', defaultConfig);

    expect(d1).toEqual(d2);
  });

  // Scenario J: No outcome is SUPPRESS
  it('Scenario J: guarantees no shadow policy outcome is ever SUPPRESS', () => {
    const states: Array<'ooo' | 'meeting' | 'focus_block' | 'quiet_window' | 'available'> = [
      'ooo',
      'meeting',
      'focus_block',
      'quiet_window',
      'available',
    ];

    const record: InterruptionRecord = {
      id: 'msg-any',
      userId: 'user-123',
      receivedAt: '2026-09-22T10:15:00.000Z',
      source: 'slack',
      channelType: 'public',
      mentionType: 'none',
      senderId: 's1',
      senderTier: 'other',
      hasUrgencySignal: false,
      slackPermalink: 'https://slack.com/archives/C1/p15',
    };

    states.forEach((st) => {
      const decision = evaluateShadowPolicy(record, st, defaultConfig);
      expect(decision.outcome).not.toBe('SUPPRESS');
      expect(['DELIVER', 'DELAY_TO_MEETING_END', 'DELAY_TO_BOUNDARY', 'BATCH']).toContain(
        decision.outcome
      );
    });
  });

});
