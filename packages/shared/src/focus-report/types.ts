export type FocusState = 'ooo' | 'meeting' | 'focus_block' | 'quiet_window' | 'available';

export type PolicyOutcome =
  | 'DELIVER'
  | 'DELAY_TO_MEETING_END'
  | 'DELAY_TO_BOUNDARY'
  | 'BATCH';

export type PolicyVersion = 'shadow-v0.1';

export type ReasonCode =
  | 'NEVER_SUPPRESS_VIP'
  | 'NEVER_SUPPRESS_INCIDENT'
  | 'STATE_AVAILABLE'
  | 'STATE_OOO_BOUNDARY'
  | 'DIRECT_MENTION_URGENT'
  | 'MEETING_DELAY_TO_END'
  | 'FOCUS_BLOCK_BATCH_CHANNEL'
  | 'FOCUS_BLOCK_DELAY_BOUNDARY'
  | 'QUIET_WINDOW_DELAY_BOUNDARY';

export interface UserSettings {
  userId: string;
  workingHours: {
    start: string; // e.g. "09:00"
    end: string;   // e.g. "18:00"
    tz: string;    // e.g. "America/New_York"
  };
  recoveryMinutesAssumption: number; // default 23
  quietWindowThresholdMinutes: number; // default 45
  urgencyKeywords: string[];
  vipUserIds: string[];
  vipSenders: string[];
  incidentChannelKeywords: string[];
  batchWindows: string[]; // e.g. ["11:30", "16:30"]
}

export interface DerivedCalendarBlock {
  id: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  kind: 'ooo' | 'meeting' | 'focus_block' | 'other';
  isBusy: boolean;
  attendeeCount: number;
}

export interface InterruptionRecord {
  id: string;
  userId: string;
  receivedAt: string; // ISO 8601
  source: 'slack';
  channelType: 'dm' | 'group_dm' | 'private' | 'public';
  mentionType: 'direct' | 'channel' | 'here' | 'thread_reply' | 'none';
  senderId: string;
  senderTier: 'vip' | 'frequent' | 'other';
  isIncidentChannel?: boolean;
  hasUrgencySignal: boolean;
  slackPermalink: string; // Slack deep link for user review
  stateAtArrival?: FocusState;
  userRepliedWithinSec?: number;
}

export interface ShadowDecision {
  interruptionId: string;
  userId: string;
  outcome: PolicyOutcome;
  reasonCode: ReasonCode;
  policyVersion: PolicyVersion;
  evaluatedAt: string; // ISO 8601
  wouldDeliverAt: string; // ISO 8601
}

export type ReviewVerdict = 'hurt' | 'fine' | 'unsure';

export interface DecisionReview {
  id: string;
  interruptionId: string;
  userId: string;
  policyVersion: PolicyVersion;
  verdict: ReviewVerdict;
  comment?: string;
  createdAt: string; // ISO 8601
}

export interface FocusReportMetricItem<T> {
  value: T;
  type: 'MEASURED' | 'DERIVED' | 'ESTIMATED';
  description: string;
  assumptionNote?: string;
}

export interface FocusReportMetrics {
  totalInterruptions: FocusReportMetricItem<number>;
  interruptionsByState: FocusReportMetricItem<Record<FocusState, number>>;
  outcomeBreakdown: FocusReportMetricItem<Record<PolicyOutcome, number>>;
  estimatedAvoidableShare: FocusReportMetricItem<number>; // percentage 0-1
  adjustedAvoidableShare: FocusReportMetricItem<number>;  // percentage 0-1 after reviews
  fragmentationScoreMinutes: FocusReportMetricItem<number>; // median available window length
  longestProtectedBlockMinutes: FocusReportMetricItem<number>; // longest stretch without interruptions
  estimatedRecoveryCostMinutes: FocusReportMetricItem<number>;
  criticalDelayRate: FocusReportMetricItem<number>; // percentage 0-1 based on reviews
  teamChannelCostEngineerHours: FocusReportMetricItem<number>;
}

export interface FocusReport {
  id: string;
  userId: string;
  periodStart: string; // ISO 8601
  periodEnd: string;   // ISO 8601
  generatedAt: string; // ISO 8601
  policyVersion: PolicyVersion;
  assumptions: UserSettings;
  metrics: FocusReportMetrics;
  sampledReviewQueue: Array<{
    interruption: InterruptionRecord;
    decision: ShadowDecision;
    existingReview?: DecisionReview;
  }>;
}
