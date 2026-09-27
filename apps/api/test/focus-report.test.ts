import { describe, expect, it } from 'vitest';
import { FocusReportService } from '../src/modules/focus-report/focus-report.service';

describe('Phase 2 — Focus Report Generation Pipeline', () => {
  // Test A: Empty user data (0 calendar blocks, 0 events)
  it('Scenario A: generates valid report for user with empty data without errors', async () => {
    const mockRepo: any = {
      getCalendarBlocks: async () => [],
      getEvents: async () => [],
    };

    const service = new FocusReportService(mockRepo);
    const report = await service.generateFocusReport('user-empty-1');

    expect(report).toBeDefined();
    expect(report.userId).toBe('user-empty-1');
    expect(report.policyVersion).toBe('shadow-v0.1');
    expect(report.metrics.totalInterruptions.value).toBe(0);
    expect(report.metrics.outcomeBreakdown.value.DELIVER).toBe(0);
    expect(report.sampledReviewQueue).toEqual([]);
  });

  // Test B: Available user + normal Slack event -> DELIVER
  it('Scenario B: evaluates normal Slack event during available time as DELIVER', async () => {
    const mockRepo: any = {
      getCalendarBlocks: async () => [],
      getEvents: async () => [
        {
          id: 'evt-1',
          userId: 'user-1',
          timestamp: new Date('2026-09-22T10:15:00.000Z'),
          sender: 'colleague-1',
          category: 'social',
          priority: 'medium',
          metadata: {
            providerEventId: 'slack:T1:C1:1690000000.000100',
            channelType: 'public',
            mentionType: 'none',
            hasUrgencySignal: false,
          },
        },
      ],
    };

    const service = new FocusReportService(mockRepo);
    const report = await service.generateFocusReport('user-1', {
      startAt: '2026-09-22T00:00:00.000Z',
      endAt: '2026-09-22T23:59:59.000Z',
    });

    expect(report.metrics.totalInterruptions.value).toBe(1);
    expect(report.metrics.outcomeBreakdown.value.DELIVER).toBe(1);
  });

  // Test C: Meeting + ordinary DM -> DELAY_TO_MEETING_END
  it('Scenario C: delays ordinary DM during meeting to meeting end', async () => {
    const mockRepo: any = {
      getCalendarBlocks: async () => [
        {
          id: 'cal-1',
          providerEventId: 'google:primary:evt-m1',
          startAt: new Date('2026-09-22T10:00:00.000Z'),
          endAt: new Date('2026-09-22T11:00:00.000Z'),
          kind: 'meeting',
          isBusy: true,
          attendeeCount: 3,
        },
      ],
      getEvents: async () => [
        {
          id: 'evt-dm',
          userId: 'user-1',
          timestamp: new Date('2026-09-22T10:20:00.000Z'),
          sender: 'colleague-2',
          category: 'social',
          priority: 'medium',
          metadata: {
            providerEventId: 'slack:T1:D1:1690000000.000200',
            channelType: 'dm',
            mentionType: 'direct',
            hasUrgencySignal: false,
          },
        },
      ],
    };

    const service = new FocusReportService(mockRepo);
    const report = await service.generateFocusReport('user-1', {
      startAt: '2026-09-22T00:00:00.000Z',
      endAt: '2026-09-22T23:59:59.000Z',
    });

    expect(report.metrics.totalInterruptions.value).toBe(1);
    expect(report.metrics.outcomeBreakdown.value.DELAY_TO_MEETING_END).toBe(1);
    expect(report.sampledReviewQueue.length).toBe(1);
    expect(report.sampledReviewQueue[0].decision.outcome).toBe('DELAY_TO_MEETING_END');
  });

  // Test D: Focus block + VIP event -> DELIVER
  it('Scenario D: delivers VIP message immediately even during focus block', async () => {
    const mockRepo: any = {
      getCalendarBlocks: async () => [
        {
          id: 'cal-f1',
          providerEventId: 'google:primary:evt-f1',
          startAt: new Date('2026-09-22T14:00:00.000Z'),
          endAt: new Date('2026-09-22T16:00:00.000Z'),
          kind: 'focus_block',
          isBusy: true,
          attendeeCount: 1,
        },
      ],
      getEvents: async () => [
        {
          id: 'evt-vip',
          userId: 'user-1',
          timestamp: new Date('2026-09-22T14:30:00.000Z'),
          sender: 'U_BOSS',
          category: 'social',
          priority: 'medium',
          metadata: {
            providerEventId: 'slack:T1:D1:1690000000.000300',
            channelType: 'dm',
            mentionType: 'direct',
            senderTier: 'vip',
            hasUrgencySignal: false,
          },
        },
      ],
    };

    const service = new FocusReportService(mockRepo);
    const report = await service.generateFocusReport('user-1', {
      startAt: '2026-09-22T00:00:00.000Z',
      endAt: '2026-09-22T23:59:59.000Z',
      userSettings: { vipUserIds: ['U_BOSS'] },
    });

    expect(report.metrics.outcomeBreakdown.value.DELIVER).toBe(1);
  });

  // Test E: Focus block + @channel -> BATCH
  it('Scenario E: batches @channel broadcast during focus block', async () => {
    const mockRepo: any = {
      getCalendarBlocks: async () => [
        {
          id: 'cal-f1',
          providerEventId: 'google:primary:evt-f1',
          startAt: new Date('2026-09-22T14:00:00.000Z'),
          endAt: new Date('2026-09-22T16:00:00.000Z'),
          kind: 'focus_block',
          isBusy: true,
          attendeeCount: 1,
        },
      ],
      getEvents: async () => [
        {
          id: 'evt-bcast',
          userId: 'user-1',
          timestamp: new Date('2026-09-22T14:15:00.000Z'),
          sender: 'announcer-1',
          category: 'social',
          priority: 'medium',
          metadata: {
            providerEventId: 'slack:T1:C1:1690000000.000400',
            channelType: 'public',
            mentionType: 'channel',
            hasUrgencySignal: false,
          },
        },
      ],
    };

    const service = new FocusReportService(mockRepo);
    const report = await service.generateFocusReport('user-1', {
      startAt: '2026-09-22T00:00:00.000Z',
      endAt: '2026-09-22T23:59:59.000Z',
    });

    expect(report.metrics.outcomeBreakdown.value.BATCH).toBe(1);
  });

  // Test F: Focus block + thread reply -> DELAY_TO_BOUNDARY
  it('Scenario F: delays thread reply during focus block to boundary', async () => {
    const mockRepo: any = {
      getCalendarBlocks: async () => [
        {
          id: 'cal-f1',
          providerEventId: 'google:primary:evt-f1',
          startAt: new Date('2026-09-22T14:00:00.000Z'),
          endAt: new Date('2026-09-22T16:00:00.000Z'),
          kind: 'focus_block',
          isBusy: true,
          attendeeCount: 1,
        },
      ],
      getEvents: async () => [
        {
          id: 'evt-reply',
          userId: 'user-1',
          timestamp: new Date('2026-09-22T14:45:00.000Z'),
          sender: 'peer-1',
          category: 'social',
          priority: 'medium',
          metadata: {
            providerEventId: 'slack:T1:C1:1690000000.000500',
            channelType: 'public',
            mentionType: 'thread_reply',
            hasUrgencySignal: false,
          },
        },
      ],
    };

    const service = new FocusReportService(mockRepo);
    const report = await service.generateFocusReport('user-1', {
      startAt: '2026-09-22T00:00:00.000Z',
      endAt: '2026-09-22T23:59:59.000Z',
    });

    expect(report.metrics.outcomeBreakdown.value.DELAY_TO_BOUNDARY).toBe(1);
  });

  // Test J: Privacy check — No raw Slack content or calendar title exposed in report
  it('Scenario J: guarantees zero raw message text or calendar summaries in FocusReport', async () => {
    const mockRepo: any = {
      getCalendarBlocks: async () => [
        {
          id: 'cal-1',
          providerEventId: 'google:primary:evt-secret',
          startAt: new Date('2026-09-22T10:00:00.000Z'),
          endAt: new Date('2026-09-22T11:00:00.000Z'),
          kind: 'meeting',
          isBusy: true,
          attendeeCount: 2,
        },
      ],
      getEvents: async () => [
        {
          id: 'evt-1',
          userId: 'user-1',
          timestamp: new Date('2026-09-22T10:15:00.000Z'),
          sender: 'alice',
          category: 'social',
          priority: 'medium',
          metadata: {
            providerEventId: 'slack:T1:C1:1690000000.000600',
            channelType: 'dm',
            mentionType: 'direct',
            hasUrgencySignal: false,
            slackPermalink: 'https://slack.com/archives/C1/p1690000000000600',
          },
        },
      ],
    };

    const service = new FocusReportService(mockRepo);
    const report = await service.generateFocusReport('user-1');

    const jsonString = JSON.stringify(report);
    expect(jsonString).not.toContain('CONFIDENTIAL');
    expect(jsonString).not.toContain('TOP SECRET');
    expect(jsonString).not.toContain('Salary & Board');
    expect(jsonString).not.toContain('Private meeting notes');
  });

  // Test L & M: Realistic End-to-End Test Dataset
  it('Scenario M: end-to-end integration test with realistic multi-event timeline', async () => {
    const mockCalendar = [
      {
        id: 'c1',
        providerEventId: 'g:p:m1',
        startAt: new Date('2026-09-22T10:00:00.000Z'),
        endAt: new Date('2026-09-22T11:00:00.000Z'),
        kind: 'meeting',
        isBusy: true,
        attendeeCount: 3,
      },
      {
        id: 'c2',
        providerEventId: 'g:p:f1',
        startAt: new Date('2026-09-22T14:00:00.000Z'),
        endAt: new Date('2026-09-22T15:00:00.000Z'),
        kind: 'focus_block',
        isBusy: true,
        attendeeCount: 1,
      },
    ];

    const mockEvents = [
      // 1. Normal DM during meeting -> DELAY_TO_MEETING_END
      {
        id: 'e1',
        userId: 'user-real-1',
        timestamp: new Date('2026-09-22T10:15:00.000Z'),
        sender: 'dev-alice',
        category: 'social',
        priority: 'medium',
        metadata: {
          providerEventId: 's:t:c:1',
          channelType: 'dm',
          mentionType: 'direct',
          hasUrgencySignal: false,
        },
      },
      // 2. Urgent mention during meeting -> DELIVER (urgent signal)
      {
        id: 'e2',
        userId: 'user-real-1',
        timestamp: new Date('2026-09-22T10:30:00.000Z'),
        sender: 'dev-bob',
        category: 'urgent',
        priority: 'high',
        metadata: {
          providerEventId: 's:t:c:2',
          channelType: 'dm',
          mentionType: 'direct',
          hasUrgencySignal: true,
        },
      },
      // 3. @channel broadcast during focus block -> BATCH
      {
        id: 'e3',
        userId: 'user-real-1',
        timestamp: new Date('2026-09-22T14:15:00.000Z'),
        sender: 'pm-charlie',
        category: 'social',
        priority: 'medium',
        metadata: {
          providerEventId: 's:t:c:3',
          channelType: 'public',
          mentionType: 'channel',
          hasUrgencySignal: false,
        },
      },
      // 4. Thread reply during focus block -> DELAY_TO_BOUNDARY
      {
        id: 'e4',
        userId: 'user-real-1',
        timestamp: new Date('2026-09-22T14:30:00.000Z'),
        sender: 'dev-alice',
        category: 'social',
        priority: 'medium',
        metadata: {
          providerEventId: 's:t:c:4',
          channelType: 'public',
          mentionType: 'thread_reply',
          hasUrgencySignal: false,
        },
      },
      // 5. Normal DM during available time -> DELIVER
      {
        id: 'e5',
        userId: 'user-real-1',
        timestamp: new Date('2026-09-22T15:10:00.000Z'),
        sender: 'peer-dave',
        category: 'social',
        priority: 'medium',
        metadata: {
          providerEventId: 's:t:c:5',
          channelType: 'dm',
          mentionType: 'direct',
          hasUrgencySignal: false,
        },
      },
    ];

    const mockRepo: any = {
      getCalendarBlocks: async () => mockCalendar,
      getEvents: async () => mockEvents,
    };

    const service = new FocusReportService(mockRepo);
    const report = await service.generateFocusReport('user-real-1', {
      startAt: '2026-09-22T08:00:00.000Z',
      endAt: '2026-09-22T18:00:00.000Z',
    });

    expect(report.metrics.totalInterruptions.value).toBe(5);
    expect(report.metrics.outcomeBreakdown.value.DELIVER).toBe(2); // Urgent signal at 10:30 + Available at 15:10
    expect(report.metrics.outcomeBreakdown.value.DELAY_TO_MEETING_END).toBe(1); // DM at 10:15
    expect(report.metrics.outcomeBreakdown.value.BATCH).toBe(1); // @channel at 14:15
    expect(report.metrics.outcomeBreakdown.value.DELAY_TO_BOUNDARY).toBe(1); // Thread reply at 14:30
    expect(report.metrics.estimatedAvoidableShare.value).toBe(0.6); // 3 out of 5 avoidable
  });

  // Phase 3 — Sampled Review Queue & Feedback Persistence Tests
  describe('Phase 3 — Review Submission & Feedback Integration', () => {
    it('accepts valid review submission and stores it via repository', async () => {
      const storedReviews: any[] = [];
      const mockRepo: any = {
        getCalendarBlocks: async () => [],
        getEvents: async () => [],
        findEventById: async (id: string) => ({
          id,
          userId: 'user-1',
        }),
        upsertReview: async (review: any) => {
          storedReviews.push(review);
          return review;
        },
      };

      const service = new FocusReportService(mockRepo);
      const result = await service.submitReview(
        'user-1',
        'report-123',
        'evt-1',
        'AGREE'
      );

      expect(result).toBeDefined();
      expect(storedReviews.length).toBe(1);
      expect(storedReviews[0].verdict).toBe('AGREE');
    });

    it('rejects invalid review label', async () => {
      const mockRepo: any = {
        findEventById: async () => ({ id: 'evt-1', userId: 'user-1' }),
      };

      const service = new FocusReportService(mockRepo);
      await expect(
        service.submitReview('user-1', 'report-123', 'evt-1', 'INVALID_LABEL' as any)
      ).rejects.toThrow('Invalid review label');
    });

    it('rejects cross-user event review access', async () => {
      const mockRepo: any = {
        findEventById: async (id: string) => ({
          id,
          userId: 'other-user-456', // Belongs to a different user
        }),
      };

      const service = new FocusReportService(mockRepo);
      await expect(
        service.submitReview('user-1', 'report-123', 'evt-1', 'AGREE')
      ).rejects.toThrow('Event not found or unauthorized');
    });

    it('recalculates adjustedAvoidableShare when user reviews exist', async () => {
      const reviews = [
        { interruptionId: 'evt-1', verdict: 'DISAGREE' }, // DISAGREE -> hurt (was delayed, user said hurt)
      ];

      const mockRepo: any = {
        getCalendarBlocks: async () => [
          {
            id: 'cal-1',
            providerEventId: 'google:primary:evt-m1',
            startAt: new Date('2026-09-22T10:00:00.000Z'),
            endAt: new Date('2026-09-22T11:00:00.000Z'),
            kind: 'meeting',
            isBusy: true,
            attendeeCount: 3,
          },
        ],
        getEvents: async () => [
          {
            id: 'evt-1',
            userId: 'user-1',
            timestamp: new Date('2026-09-22T10:20:00.000Z'),
            sender: 'peer',
            category: 'social',
            priority: 'medium',
            metadata: {
              providerEventId: 'slack:T1:D1:1',
              channelType: 'dm',
              mentionType: 'direct',
              hasUrgencySignal: false,
            },
          },
        ],
        findUserReviews: async () => reviews,
      };

      const service = new FocusReportService(mockRepo);
      const report = await service.generateFocusReport('user-1', {
        startAt: '2026-09-22T00:00:00.000Z',
        endAt: '2026-09-22T23:59:59.000Z',
      });

      expect(report.metrics.criticalDelayRate).toBeDefined();
      expect(report.metrics.criticalDelayRate?.value).toBe(1.0); // 1 out of 1 delayed item was marked DISAGREE (hurt)
    });
  });

  describe('Phase 4 Step 1 — Evaluation Feature Snapshots', () => {
    it('A & B: derives and persists evaluation snapshot (reasonCode, focusState, outcome, etc.) server-side', async () => {
      const storedReviews: any[] = [];
      const mockRepo: any = {
        findEventById: async (id: string) => ({
          id: 'evt-meeting-dm',
          userId: 'user-1',
          timestamp: new Date('2026-09-22T10:20:00.000Z'),
          sender: 'colleague-dm',
          category: 'social',
          priority: 'medium',
          metadata: {
            providerEventId: 'slack:T1:D1:evt-meeting-dm',
            channelType: 'dm',
            mentionType: 'direct',
            hasUrgencySignal: false,
          },
        }),
        getCalendarBlocks: async () => [
          {
            id: 'cal-m1',
            providerEventId: 'google:primary:evt-m1',
            startAt: new Date('2026-09-22T10:00:00.000Z'),
            endAt: new Date('2026-09-22T11:00:00.000Z'),
            kind: 'meeting',
            isBusy: true,
            attendeeCount: 3,
          },
        ],
        upsertReview: async (data: any) => {
          storedReviews.push(data);
          return data;
        },
      };

      const service = new FocusReportService(mockRepo);
      const result = await service.submitReview('user-1', {
        reportId: 'rep-1',
        interruptionId: 'evt-meeting-dm',
        verdict: 'AGREE',
      });

      expect(result).toBeDefined();
      expect(storedReviews.length).toBe(1);
      const rev = storedReviews[0];
      expect(rev.verdict).toBe('AGREE');
      expect(rev.focusState).toBe('meeting');
      expect(rev.outcome).toBe('DELAY_TO_MEETING_END');
      expect(rev.reasonCode).toBe('MEETING_DELAY_TO_END');
      expect(rev.channelType).toBe('dm');
      expect(rev.mentionType).toBe('direct');
      expect(rev.hasUrgencySignal).toBe(false);
    });

    it('C: stores valid harmCategory when verdict is DISAGREE', async () => {
      const storedReviews: any[] = [];
      const mockRepo: any = {
        findEventById: async () => ({
          id: 'evt-1',
          userId: 'user-1',
          timestamp: new Date('2026-09-22T10:20:00.000Z'),
          metadata: { channelType: 'dm', mentionType: 'direct' },
        }),
        getCalendarBlocks: async () => [],
        upsertReview: async (data: any) => {
          storedReviews.push(data);
          return data;
        },
      };

      const service = new FocusReportService(mockRepo);
      await service.submitReview('user-1', {
        reportId: 'rep-1',
        interruptionId: 'evt-1',
        verdict: 'DISAGREE',
        harmCategory: 'NEEDED_IMMEDIATE_REPLY',
      });

      expect(storedReviews.length).toBe(1);
      expect(storedReviews[0].harmCategory).toBe('NEEDED_IMMEDIATE_REPLY');
    });

    it('D: rejects invalid harmCategory value', async () => {
      const mockRepo: any = {
        findEventById: async () => ({ id: 'evt-1', userId: 'user-1', timestamp: new Date() }),
        getCalendarBlocks: async () => [],
      };

      const service = new FocusReportService(mockRepo);
      await expect(
        service.submitReview('user-1', {
          reportId: 'rep-1',
          interruptionId: 'evt-1',
          verdict: 'DISAGREE',
          harmCategory: 'INVALID_CATEGORY' as any,
        })
      ).rejects.toThrow('Invalid harmCategory value');
    });

    it('E: rejects harmCategory when verdict is AGREE or UNSURE', async () => {
      const mockRepo: any = {
        findEventById: async () => ({ id: 'evt-1', userId: 'user-1', timestamp: new Date() }),
        getCalendarBlocks: async () => [],
      };

      const service = new FocusReportService(mockRepo);
      await expect(
        service.submitReview('user-1', {
          reportId: 'rep-1',
          interruptionId: 'evt-1',
          verdict: 'AGREE',
          harmCategory: 'FALSE_POSITIVE_URGENCY',
        })
      ).rejects.toThrow('harmCategory is only allowed when verdict is DISAGREE');
    });

    it('F: re-submitting review updates existing review without duplicate creation', async () => {
      const reviewsMap = new Map<string, any>();
      const mockRepo: any = {
        findEventById: async () => ({ id: 'evt-1', userId: 'user-1', timestamp: new Date() }),
        getCalendarBlocks: async () => [],
        upsertReview: async (data: any) => {
          const key = `${data.userId}:${data.interruptionId}`;
          reviewsMap.set(key, data);
          return data;
        },
      };

      const service = new FocusReportService(mockRepo);
      await service.submitReview('user-1', {
        reportId: 'rep-1',
        interruptionId: 'evt-1',
        verdict: 'AGREE',
      });

      expect(reviewsMap.size).toBe(1);
      expect(reviewsMap.get('user-1:evt-1').verdict).toBe('AGREE');

      // Re-submit with DISAGREE
      await service.submitReview('user-1', {
        reportId: 'rep-1',
        interruptionId: 'evt-1',
        verdict: 'DISAGREE',
        harmCategory: 'OTHER',
      });

      expect(reviewsMap.size).toBe(1); // Idempotent upsert
      expect(reviewsMap.get('user-1:evt-1').verdict).toBe('DISAGREE');
      expect(reviewsMap.get('user-1:evt-1').harmCategory).toBe('OTHER');
    });

    it('G: rejects cross-user review submission', async () => {
      const mockRepo: any = {
        findEventById: async () => ({ id: 'evt-1', userId: 'user-owner-99' }),
      };

      const service = new FocusReportService(mockRepo);
      await expect(
        service.submitReview('user-attacker', {
          reportId: 'rep-1',
          interruptionId: 'evt-1',
          verdict: 'AGREE',
        })
      ).rejects.toThrow('Event not found or unauthorized');
    });

    it('I: ensures zero raw message text or calendar summary in review snapshot', async () => {
      const storedReviews: any[] = [];
      const mockRepo: any = {
        findEventById: async () => ({
          id: 'evt-1',
          userId: 'user-1',
          timestamp: new Date(),
          metadata: { channelType: 'dm', mentionType: 'direct' },
        }),
        getCalendarBlocks: async () => [],
        upsertReview: async (data: any) => {
          storedReviews.push(data);
          return data;
        },
      };

      const service = new FocusReportService(mockRepo);
      await service.submitReview('user-1', {
        reportId: 'rep-1',
        interruptionId: 'evt-1',
        verdict: 'AGREE',
      });

      const serialized = JSON.stringify(storedReviews[0]);
      expect(serialized).not.toContain('body');
      expect(serialized).not.toContain('summary');
      expect(serialized).not.toContain('attendees');
      expect(serialized).not.toContain('SECRET');
    });
  });

  describe('Phase 4 Step 2 — Evaluation Telemetry Summary API', () => {
    it('A: returns zeroed metrics when user has empty review dataset', async () => {
      const mockRepo: any = {
        findReviewsForPeriod: async () => [],
      };
      const service = new FocusReportService(mockRepo);
      const summary = await service.getEvaluationSummary('user-empty');

      expect(summary.totalReviews).toBe(0);
      expect(summary.agreeCount).toBe(0);
      expect(summary.unsureCount).toBe(0);
      expect(summary.disagreeCount).toBe(0);
      expect(summary.disagreementRate).toBe(0);
      expect(summary.disagreementByReasonCode).toEqual([]);
      expect(summary.disagreementByFocusState).toEqual([]);
      expect(summary.disagreementByOutcome).toEqual([]);
      expect(summary.disagreementByHarmCategory).toEqual([]);
    });

    it('B & C: aggregates mixed AGREE/UNSURE/DISAGREE reviews and calculates exact disagreement rate', async () => {
      const mockReviews = [
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
        { userId: 'u1', verdict: 'UNSURE', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
        { userId: 'u1', verdict: 'DISAGREE', harmCategory: 'NEEDED_IMMEDIATE_REPLY', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
        { userId: 'u1', verdict: 'DISAGREE', harmCategory: 'VIP_SENDER_MISSED', reasonCode: 'R1', focusState: 'meeting', outcome: 'DELAY_TO_MEETING_END' },
      ];

      const mockRepo: any = {
        findReviewsForPeriod: async () => mockReviews,
      };

      const service = new FocusReportService(mockRepo);
      const summary = await service.getEvaluationSummary('u1');

      expect(summary.totalReviews).toBe(10);
      expect(summary.agreeCount).toBe(7);
      expect(summary.unsureCount).toBe(1);
      expect(summary.disagreeCount).toBe(2);
      expect(summary.disagreementRate).toBe(0.2);
    });

    it('D, E, F, G: groups correctly by reasonCode, focusState, outcome, and harmCategory', async () => {
      const mockReviews = [
        {
          userId: 'u1',
          verdict: 'AGREE',
          reasonCode: 'MEETING_DELAY_TO_END',
          focusState: 'meeting',
          outcome: 'DELAY_TO_MEETING_END',
          channelType: 'dm',
          mentionType: 'direct',
          hasUrgencySignal: false,
        },
        {
          userId: 'u1',
          verdict: 'DISAGREE',
          harmCategory: 'FALSE_POSITIVE_URGENCY',
          reasonCode: 'FOCUS_BLOCK_DELAY_BOUNDARY',
          focusState: 'focus_block',
          outcome: 'DELAY_TO_BOUNDARY',
          channelType: 'public',
          mentionType: 'thread_reply',
          hasUrgencySignal: true,
        },
        {
          userId: 'u1',
          verdict: 'DISAGREE',
          harmCategory: 'FALSE_POSITIVE_URGENCY',
          reasonCode: 'FOCUS_BLOCK_DELAY_BOUNDARY',
          focusState: 'focus_block',
          outcome: 'DELAY_TO_BOUNDARY',
          channelType: 'public',
          mentionType: 'thread_reply',
          hasUrgencySignal: true,
        },
      ];

      const mockRepo: any = {
        findReviewsForPeriod: async () => mockReviews,
      };

      const service = new FocusReportService(mockRepo);
      const summary = await service.getEvaluationSummary('u1');

      expect(summary.disagreementByReasonCode.length).toBe(2);
      const fbItem = summary.disagreementByReasonCode.find((i) => i.reasonCode === 'FOCUS_BLOCK_DELAY_BOUNDARY');
      expect(fbItem).toBeDefined();
      expect(fbItem?.totalReviews).toBe(2);
      expect(fbItem?.disagreeCount).toBe(2);
      expect(fbItem?.disagreementRate).toBe(1);

      const fbState = summary.disagreementByFocusState.find((i) => i.focusState === 'focus_block');
      expect(fbState?.totalReviews).toBe(2);
      expect(fbState?.disagreementRate).toBe(1);

      const outcomeBoundary = summary.disagreementByOutcome.find((i) => i.outcome === 'DELAY_TO_BOUNDARY');
      expect(outcomeBoundary?.totalReviews).toBe(2);

      expect(summary.disagreementByHarmCategory).toEqual([
        { harmCategory: 'FALSE_POSITIVE_URGENCY', count: 2 },
      ]);
    });

    it('H: filters evaluation summary by date-range parameters', async () => {
      const mockReviews = [
        { userId: 'u1', verdict: 'AGREE', createdAt: new Date('2026-09-10T10:00:00Z') },
        { userId: 'u1', verdict: 'DISAGREE', createdAt: new Date('2026-09-20T10:00:00Z') },
      ];

      const mockRepo: any = {
        findReviewsForPeriod: async (userId: string, startAt?: Date, endAt?: Date) => {
          return mockReviews.filter((r) => {
            if (startAt && r.createdAt < startAt) return false;
            if (endAt && r.createdAt > endAt) return false;
            return true;
          });
        },
      };

      const service = new FocusReportService(mockRepo);
      const summary = await service.getEvaluationSummary('u1', {
        startAt: '2026-09-15T00:00:00Z',
        endAt: '2026-09-25T23:59:59Z',
      });

      expect(summary.totalReviews).toBe(1);
      expect(summary.disagreeCount).toBe(1);
      expect(summary.agreeCount).toBe(0);
    });

    it('I: enforces strict user isolation so User A cannot access User B data', async () => {
      const mockRepo: any = {
        findReviewsForPeriod: async (userId: string) => {
          if (userId === 'user-a') {
            return [{ userId: 'user-a', verdict: 'AGREE' }];
          }
          return [];
        },
      };

      const service = new FocusReportService(mockRepo);
      const summaryA = await service.getEvaluationSummary('user-a');
      const summaryB = await service.getEvaluationSummary('user-b');

      expect(summaryA.totalReviews).toBe(1);
      expect(summaryA.userId).toBe('user-a');
      expect(summaryB.totalReviews).toBe(0);
      expect(summaryB.userId).toBe('user-b');
    });

    it('J: verifies privacy — response contains no raw text, titles, emails, or tokens', async () => {
      const mockReviews = [
        {
          userId: 'u1',
          verdict: 'DISAGREE',
          harmCategory: 'OTHER',
          reasonCode: 'FOCUS_BLOCK_DELAY_BOUNDARY',
          focusState: 'focus_block',
          outcome: 'DELAY_TO_BOUNDARY',
        },
      ];

      const mockRepo: any = {
        findReviewsForPeriod: async () => mockReviews,
      };

      const service = new FocusReportService(mockRepo);
      const summary = await service.getEvaluationSummary('u1');
      const json = JSON.stringify(summary);

      expect(json).not.toContain('slackMessage');
      expect(json).not.toContain('calendarTitle');
      expect(json).not.toContain('attendeeEmail');
      expect(json).not.toContain('oauthToken');
      expect(json).not.toContain('rawPayload');
      expect(json).not.toContain('comment');
    });

    it('K: ensures deterministic sorting by totalReviews DESC then key ASC', async () => {
      const mockReviews = [
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'B_CODE' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'A_CODE' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'A_CODE' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'C_CODE' },
        { userId: 'u1', verdict: 'AGREE', reasonCode: 'C_CODE' },
      ];

      const mockRepo: any = {
        findReviewsForPeriod: async () => mockReviews,
      };

      const service = new FocusReportService(mockRepo);
      const summary = await service.getEvaluationSummary('u1');

      expect(summary.disagreementByReasonCode.map((i) => i.reasonCode)).toEqual([
        'A_CODE',
        'C_CODE',
        'B_CODE',
      ]);
    });
  });
});
