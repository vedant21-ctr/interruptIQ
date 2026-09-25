import {
  DecisionReview,
  DerivedCalendarBlock,
  FocusReport,
  InterruptionRecord,
  ReviewVerdict,
  runReplaySimulator,
  UserSettings,
} from '@interrupt-iq/shared';
import { BadRequestError } from '../../errors/app-error';
import { FocusReportRepository } from './focus-report.repository';

export interface GenerateFocusReportOptions {
  startAt?: string;
  endAt?: string;
  userSettings?: Partial<UserSettings>;
}

export interface SubmitReviewDto {
  reportId: string;
  interruptionId: string;
  verdict: 'AGREE' | 'UNSURE' | 'DISAGREE';
  comment?: string;
}

export class FocusReportService {
  private repository: FocusReportRepository;

  constructor(repository: FocusReportRepository) {
    this.repository = repository;
  }

  async generateFocusReport(
    userId: string,
    options?: GenerateFocusReportOptions
  ): Promise<FocusReport> {
    const endAtIso = options?.endAt || new Date().toISOString();
    const startAtIso =
      options?.startAt ||
      new Date(new Date(endAtIso).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const startAtDate = new Date(startAtIso);
    const endAtDate = new Date(endAtIso);

    // 1. Fetch DB CalendarBlocks and map to DerivedCalendarBlock domain objects
    const dbBlocks = await this.repository.getCalendarBlocks(userId, startAtDate, endAtDate);
    const calendarBlocks: DerivedCalendarBlock[] = dbBlocks.map((b) => ({
      id: b.providerEventId || b.id,
      start: b.startAt.toISOString(),
      end: b.endAt.toISOString(),
      kind: (['ooo', 'meeting', 'focus_block', 'other'].includes(b.kind)
        ? b.kind
        : 'other') as 'ooo' | 'meeting' | 'focus_block' | 'other',
      isBusy: b.isBusy,
      attendeeCount: b.attendeeCount,
    }));

    // 2. Fetch DB Events and map to InterruptionRecord domain objects
    const dbEvents = await this.repository.getEvents(userId, startAtDate, endAtDate);
    const interruptions: InterruptionRecord[] = dbEvents.map((e) => {
      const metadata = (e.metadata as any) || {};
      const channelType = metadata.channelType || 'public';
      const mentionType = metadata.mentionType || 'none';
      const slackPermalink =
        metadata.slackPermalink ||
        `https://slack.com/archives/C00000000/p${e.timestamp.getTime()}`;
      const hasUrgencySignal =
        metadata.hasUrgencySignal ??
        (e.category === 'urgent' || e.priority === 'urgent' || e.priority === 'high');

      return {
        id: metadata.providerEventId || e.id,
        userId: e.userId,
        receivedAt: e.timestamp.toISOString(),
        source: 'slack',
        channelType: ['dm', 'group_dm', 'private', 'public'].includes(channelType)
          ? channelType
          : 'public',
        mentionType: ['direct', 'channel', 'here', 'thread_reply', 'none'].includes(mentionType)
          ? mentionType
          : 'none',
        senderId: e.sender || 'unknown_sender',
        senderTier: metadata.senderTier || 'other',
        hasUrgencySignal,
        slackPermalink,
        isIncidentChannel: metadata.isIncidentChannel ?? false,
      };
    });

    // 3. Load user's persisted decision reviews
    const dbReviews = (await this.repository.findUserReviews?.(userId, 'shadow-v0.1')) || [];
    const reviews: DecisionReview[] = dbReviews.map((r) => {
      const mappedVerdict: ReviewVerdict =
        r.verdict === 'DISAGREE' ? 'hurt' : r.verdict === 'AGREE' ? 'fine' : 'unsure';
      return {
        id: r.id || `rev-${r.interruptionId}`,
        interruptionId: r.interruptionId,
        userId: r.userId || userId,
        policyVersion: 'shadow-v0.1',
        verdict: mappedVerdict,
        comment: r.comment || undefined,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      };
    });

    // 4. User configuration assumptions
    const config: UserSettings = {
      userId,
      workingHours: { start: '09:00', end: '18:00', tz: 'UTC' },
      recoveryMinutesAssumption: 23,
      quietWindowThresholdMinutes: 45,
      urgencyKeywords: ['URGENT', 'ASAP', 'BLOCKER', 'CRITICAL'],
      vipUserIds: [],
      vipSenders: [],
      incidentChannelKeywords: ['incident', 'oncall'],
      batchWindows: ['11:30', '16:30'],
      ...options?.userSettings,
    };

    // 5. Run deterministic replay simulator engine with existing user reviews
    const report = runReplaySimulator(calendarBlocks, interruptions, reviews, config);

    // Ensure periodStart and periodEnd accurately reflect requested time range
    return {
      ...report,
      periodStart: startAtIso,
      periodEnd: endAtIso,
    };
  }

  async submitReview(
    userId: string,
    reportIdOrDto: string | SubmitReviewDto,
    eventId?: string,
    verdict?: 'AGREE' | 'UNSURE' | 'DISAGREE',
    comment?: string
  ) {
    let reportId: string;
    let interruptionId: string;
    let reviewVerdict: 'AGREE' | 'UNSURE' | 'DISAGREE';
    let reviewComment: string | undefined;

    if (typeof reportIdOrDto === 'object') {
      reportId = reportIdOrDto.reportId;
      interruptionId = reportIdOrDto.interruptionId;
      reviewVerdict = reportIdOrDto.verdict;
      reviewComment = reportIdOrDto.comment;
    } else {
      reportId = reportIdOrDto;
      interruptionId = eventId!;
      reviewVerdict = verdict!;
      reviewComment = comment;
    }

    if (!['AGREE', 'UNSURE', 'DISAGREE'].includes(reviewVerdict)) {
      throw new BadRequestError('Invalid review label');
    }

    if (this.repository.findEventById) {
      const event = await this.repository.findEventById(interruptionId);
      if (event && event.userId !== userId) {
        throw new BadRequestError('Event not found or unauthorized');
      }
    }

    return this.repository.upsertReview({
      userId,
      reportId,
      interruptionId,
      policyVersion: 'shadow-v0.1',
      verdict: reviewVerdict,
      comment: reviewComment,
    });
  }
}
