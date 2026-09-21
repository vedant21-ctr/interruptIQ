import { inferFocusState } from './focus-state';
import { calculateFocusReportMetrics } from './metrics';
import { evaluateShadowPolicy } from './policy';
import {
  DecisionReview,
  DerivedCalendarBlock,
  FocusReport,
  InterruptionRecord,
  ShadowDecision,
  UserSettings,
} from './types';

/**
 * Replay Simulator Engine.
 * Accepts normalized fixture data and processes it through the pure shadow policy
 * and metrics calculator to produce a complete FocusReport object.
 */
export function runReplaySimulator(
  calendarBlocks: DerivedCalendarBlock[],
  interruptions: InterruptionRecord[],
  reviews: DecisionReview[] = [],
  config: UserSettings
): FocusReport {
  const sortedInterruptions = [...interruptions].sort(
    (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
  );

  let lastActivityAt: string | null = null;
  const processedRecords: InterruptionRecord[] = [];
  const decisions: ShadowDecision[] = [];

  for (const record of sortedInterruptions) {
    // 1. Infer Focus State at arrival timestamp
    const inferredState = inferFocusState(
      calendarBlocks,
      lastActivityAt,
      record.receivedAt,
      config
    );

    const recordWithState: InterruptionRecord = {
      ...record,
      stateAtArrival: inferredState,
    };
    processedRecords.push(recordWithState);

    // 2. Resolve Context Boundary Timestamps
    const meetingBlock = calendarBlocks.find(
      (b) =>
        b.kind === 'meeting' &&
        new Date(record.receivedAt).getTime() >= new Date(b.start).getTime() &&
        new Date(record.receivedAt).getTime() < new Date(b.end).getTime()
    );

    const boundaryInfo = {
      meetingEndAt: meetingBlock ? meetingBlock.end : undefined,
    };

    // 3. Evaluate Pure Shadow Policy
    const decision = evaluateShadowPolicy(recordWithState, inferredState, config, boundaryInfo);
    decisions.push(decision);

    // Update last activity timestamp tracking
    lastActivityAt = record.receivedAt;
  }

  // 4. Calculate Focus Report Metrics
  const metrics = calculateFocusReportMetrics(
    processedRecords,
    decisions,
    reviews,
    config
  );

  // 5. Select 20-item Sampled Review Queue
  const reviewMap = new Map<string, DecisionReview>();
  reviews.forEach((rv) => reviewMap.set(rv.interruptionId, rv));

  const delayedDecisions = decisions.filter(
    (d) => d.outcome === 'DELAY_TO_MEETING_END' || d.outcome === 'DELAY_TO_BOUNDARY' || d.outcome === 'BATCH'
  );

  const sampledQueue = delayedDecisions.slice(0, 20).map((dec) => {
    const interruption = processedRecords.find((r) => r.id === dec.interruptionId)!;
    return {
      interruption,
      decision: dec,
      existingReview: reviewMap.get(dec.interruptionId),
    };
  });

  const periodStart =
    sortedInterruptions.length > 0 ? sortedInterruptions[0].receivedAt : new Date().toISOString();
  const periodEnd =
    sortedInterruptions.length > 0
      ? sortedInterruptions[sortedInterruptions.length - 1].receivedAt
      : new Date().toISOString();

  return {
    id: `report-${config.userId}-${Date.now()}`,
    userId: config.userId,
    periodStart,
    periodEnd,
    generatedAt: new Date().toISOString(),
    policyVersion: 'shadow-v0.1',
    assumptions: config,
    metrics,
    sampledReviewQueue: sampledQueue,
  };
}
