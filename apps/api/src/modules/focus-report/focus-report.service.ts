import {
  DecisionReview,
  DerivedCalendarBlock,
  evaluateShadowPolicy,
  EvaluationDimensionAggregationItem,
  EvaluationSummary,
  FocusReport,
  HarmCategory,
  HarmCategoryAggregationItem,
  inferFocusState,
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

export interface EvaluationSummaryOptions {
  startAt?: string;
  endAt?: string;
}

export interface SubmitReviewDto {
  reportId: string;
  interruptionId: string;
  verdict: 'AGREE' | 'UNSURE' | 'DISAGREE';
  comment?: string;
  harmCategory?: HarmCategory;
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
    const reviews: DecisionReview[] = dbReviews.map((r: any) => {
      const mappedVerdict: ReviewVerdict =
        r.verdict === 'DISAGREE' ? 'hurt' : r.verdict === 'AGREE' ? 'fine' : 'unsure';
      return {
        id: r.id || `rev-${r.interruptionId}`,
        interruptionId: r.interruptionId,
        userId: r.userId || userId,
        policyVersion: 'shadow-v0.1',
        verdict: mappedVerdict,
        comment: r.comment || undefined,
        reasonCode: r.reasonCode || undefined,
        focusState: r.focusState || undefined,
        outcome: r.outcome || undefined,
        channelType: r.channelType || undefined,
        mentionType: r.mentionType || undefined,
        hasUrgencySignal: r.hasUrgencySignal ?? undefined,
        harmCategory: r.harmCategory || undefined,
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
    let harmCategory: HarmCategory | undefined;

    if (typeof reportIdOrDto === 'object') {
      reportId = reportIdOrDto.reportId;
      interruptionId = reportIdOrDto.interruptionId;
      reviewVerdict = reportIdOrDto.verdict;
      reviewComment = reportIdOrDto.comment;
      harmCategory = reportIdOrDto.harmCategory;
    } else {
      reportId = reportIdOrDto;
      interruptionId = eventId!;
      reviewVerdict = verdict!;
      reviewComment = comment;
    }

    if (!['AGREE', 'UNSURE', 'DISAGREE'].includes(reviewVerdict)) {
      throw new BadRequestError('Invalid review label');
    }

    const validHarmCategories: HarmCategory[] = [
      'FALSE_POSITIVE_URGENCY',
      'VIP_SENDER_MISSED',
      'NEEDED_IMMEDIATE_REPLY',
      'OTHER',
    ];

    if (harmCategory) {
      if (!validHarmCategories.includes(harmCategory)) {
        throw new BadRequestError('Invalid harmCategory value');
      }
      if (reviewVerdict !== 'DISAGREE') {
        throw new BadRequestError('harmCategory is only allowed when verdict is DISAGREE');
      }
    }

    const event = await this.repository.findEventById(interruptionId);
    if (!event || event.userId !== userId) {
      throw new BadRequestError('Event not found or unauthorized');
    }

    // Derive snapshot features from actual server data
    const metadata = (event.metadata as any) || {};
    const channelType = ['dm', 'group_dm', 'private', 'public'].includes(metadata.channelType)
      ? metadata.channelType
      : 'public';
    const mentionType = ['direct', 'channel', 'here', 'thread_reply', 'none'].includes(metadata.mentionType)
      ? metadata.mentionType
      : 'none';
    const hasUrgencySignal =
      metadata.hasUrgencySignal ??
      (event.category === 'urgent' || event.priority === 'urgent' || event.priority === 'high');

    const timestampDate = event.timestamp ? new Date(event.timestamp) : new Date();
    const timestampIso = timestampDate.toISOString();

    const interruption: InterruptionRecord = {
      id: metadata.providerEventId || event.id,
      userId: event.userId,
      receivedAt: timestampIso,
      source: 'slack',
      channelType,
      mentionType,
      senderId: event.sender || 'unknown_sender',
      senderTier: metadata.senderTier || 'other',
      hasUrgencySignal,
      slackPermalink: metadata.slackPermalink || `https://slack.com/archives/C00000000/p${timestampDate.getTime()}`,
      isIncidentChannel: metadata.isIncidentChannel ?? false,
    };

    const startAtDate = new Date(timestampDate.getTime() - 24 * 60 * 60 * 1000);
    const endAtDate = new Date(timestampDate.getTime() + 24 * 60 * 60 * 1000);
    const dbBlocks = await this.repository.getCalendarBlocks(userId, startAtDate, endAtDate);
    const calendarBlocks: DerivedCalendarBlock[] = dbBlocks.map((b) => ({
      id: b.providerEventId || b.id,
      start: b.startAt.toISOString(),
      end: b.endAt.toISOString(),
      kind: (['ooo', 'meeting', 'focus_block', 'other'].includes(b.kind) ? b.kind : 'other') as any,
      isBusy: b.isBusy,
      attendeeCount: b.attendeeCount,
    }));

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
    };

    const focusState = inferFocusState(calendarBlocks, null, timestampIso, config);
    const shadowDecision = evaluateShadowPolicy(interruption, focusState, config);

    return this.repository.upsertReview({
      userId,
      reportId,
      interruptionId,
      policyVersion: 'shadow-v0.1',
      verdict: reviewVerdict,
      comment: reviewComment,
      reasonCode: shadowDecision.reasonCode,
      focusState,
      outcome: shadowDecision.outcome,
      channelType,
      mentionType,
      hasUrgencySignal,
      harmCategory,
    });
  }

  async getEvaluationSummary(
    userId: string,
    options?: EvaluationSummaryOptions
  ): Promise<EvaluationSummary> {
    const endAtIso = options?.endAt || new Date().toISOString();
    const startAtIso =
      options?.startAt ||
      new Date(new Date(endAtIso).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const startAtDate = new Date(startAtIso);
    const endAtDate = new Date(endAtIso);

    if (isNaN(startAtDate.getTime()) || isNaN(endAtDate.getTime()) || startAtDate > endAtDate) {
      throw new BadRequestError('Invalid date range');
    }

    const dbReviews =
      (await this.repository.findReviewsForPeriod?.(userId, startAtDate, endAtDate, 'shadow-v0.1')) ||
      (await this.repository.findUserReviews?.(userId, 'shadow-v0.1')) ||
      [];

    const reviews = dbReviews.filter((r: any) => {
      if (!r.createdAt) return true;
      const created = new Date(r.createdAt).getTime();
      return created >= startAtDate.getTime() && created <= endAtDate.getTime();
    });

    let agreeCount = 0;
    let unsureCount = 0;
    let disagreeCount = 0;

    const reasonCodeMap = new Map<string, { total: number; agree: number; unsure: number; disagree: number }>();
    const focusStateMap = new Map<string, { total: number; agree: number; unsure: number; disagree: number }>();
    const outcomeMap = new Map<string, { total: number; agree: number; unsure: number; disagree: number }>();
    const harmCategoryMap = new Map<string, number>();
    const channelTypeMap = new Map<string, { total: number; agree: number; unsure: number; disagree: number }>();
    const mentionTypeMap = new Map<string, { total: number; agree: number; unsure: number; disagree: number }>();
    const urgencySignalMap = new Map<boolean, { total: number; agree: number; unsure: number; disagree: number }>();

    for (const r of reviews) {
      const isAgree = r.verdict === 'AGREE' || r.verdict === 'fine';
      const isUnsure = r.verdict === 'UNSURE' || r.verdict === 'unsure';
      const isDisagree = r.verdict === 'DISAGREE' || r.verdict === 'hurt';

      if (isAgree) agreeCount++;
      else if (isUnsure) unsureCount++;
      else if (isDisagree) disagreeCount++;

      const addDimension = (
        map: Map<string, { total: number; agree: number; unsure: number; disagree: number }>,
        key: string | null | undefined
      ) => {
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, { total: 0, agree: 0, unsure: 0, disagree: 0 });
        }
        const entry = map.get(key)!;
        entry.total++;
        if (isAgree) entry.agree++;
        else if (isUnsure) entry.unsure++;
        else if (isDisagree) entry.disagree++;
      };

      addDimension(reasonCodeMap, r.reasonCode);
      addDimension(focusStateMap, r.focusState);
      addDimension(outcomeMap, r.outcome);
      addDimension(channelTypeMap, r.channelType);
      addDimension(mentionTypeMap, r.mentionType);

      if (r.hasUrgencySignal !== null && r.hasUrgencySignal !== undefined) {
        const key = Boolean(r.hasUrgencySignal);
        if (!urgencySignalMap.has(key)) {
          urgencySignalMap.set(key, { total: 0, agree: 0, unsure: 0, disagree: 0 });
        }
        const entry = urgencySignalMap.get(key)!;
        entry.total++;
        if (isAgree) entry.agree++;
        else if (isUnsure) entry.unsure++;
        else if (isDisagree) entry.disagree++;
      }

      if (r.harmCategory) {
        harmCategoryMap.set(r.harmCategory, (harmCategoryMap.get(r.harmCategory) || 0) + 1);
      }
    }

    const totalReviews = reviews.length;
    const disagreementRate =
      totalReviews > 0 ? Number((disagreeCount / totalReviews).toFixed(3)) : 0;

    const formatDimensionList = (
      map: Map<string, { total: number; agree: number; unsure: number; disagree: number }>,
      keyName: string
    ): EvaluationDimensionAggregationItem[] => {
      const list: EvaluationDimensionAggregationItem[] = [];
      for (const [key, counts] of map.entries()) {
        const rate = counts.total > 0 ? Number((counts.disagree / counts.total).toFixed(3)) : 0;
        list.push({
          [keyName]: key,
          totalReviews: counts.total,
          agreeCount: counts.agree,
          unsureCount: counts.unsure,
          disagreeCount: counts.disagree,
          disagreementRate: rate,
        });
      }

      list.sort((a, b) => {
        if (b.totalReviews !== a.totalReviews) {
          return b.totalReviews - a.totalReviews;
        }
        return String(a[keyName]).localeCompare(String(b[keyName]));
      });

      return list;
    };

    const formatUrgencyList = (): EvaluationDimensionAggregationItem[] => {
      const list: EvaluationDimensionAggregationItem[] = [];
      for (const [key, counts] of urgencySignalMap.entries()) {
        const rate = counts.total > 0 ? Number((counts.disagree / counts.total).toFixed(3)) : 0;
        list.push({
          hasUrgencySignal: key,
          totalReviews: counts.total,
          agreeCount: counts.agree,
          unsureCount: counts.unsure,
          disagreeCount: counts.disagree,
          disagreementRate: rate,
        });
      }
      list.sort((a, b) => {
        if (b.totalReviews !== a.totalReviews) {
          return b.totalReviews - a.totalReviews;
        }
        return String(a.hasUrgencySignal).localeCompare(String(b.hasUrgencySignal));
      });
      return list;
    };

    const harmCategoryList: HarmCategoryAggregationItem[] = Array.from(
      harmCategoryMap.entries()
    ).map(([harmCategory, count]) => ({
      harmCategory: harmCategory as HarmCategory,
      count,
    }));

    harmCategoryList.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return String(a.harmCategory).localeCompare(String(b.harmCategory));
    });

    return {
      userId,
      policyVersion: 'shadow-v0.1',
      periodStart: startAtIso,
      periodEnd: endAtIso,
      totalReviews,
      agreeCount,
      unsureCount,
      disagreeCount,
      disagreementRate,
      disagreementByReasonCode: formatDimensionList(reasonCodeMap, 'reasonCode'),
      disagreementByFocusState: formatDimensionList(focusStateMap, 'focusState'),
      disagreementByOutcome: formatDimensionList(outcomeMap, 'outcome'),
      disagreementByHarmCategory: harmCategoryList,
      disagreementByChannelType: formatDimensionList(channelTypeMap, 'channelType'),
      disagreementByMentionType: formatDimensionList(mentionTypeMap, 'mentionType'),
      disagreementByUrgencySignal: formatUrgencyList(),
    };
  }
}
