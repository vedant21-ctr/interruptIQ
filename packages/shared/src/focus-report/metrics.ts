import {
  DecisionReview,
  FocusReportMetrics,
  FocusState,
  InterruptionRecord,
  PolicyOutcome,
  ShadowDecision,
  UserSettings,
} from './types';

/**
 * Pure function calculating Focus Report metrics.
 * Classifies every metric clearly as MEASURED, DERIVED, or ESTIMATED.
 */
export function calculateFocusReportMetrics(
  records: InterruptionRecord[],
  decisions: ShadowDecision[],
  reviews: DecisionReview[],
  config: UserSettings
): FocusReportMetrics {
  const totalCount = records.length;

  // 1. Interruptions by Focus State (MEASURED)
  const stateCounts: Record<FocusState, number> = {
    ooo: 0,
    meeting: 0,
    focus_block: 0,
    quiet_window: 0,
    available: 0,
  };

  records.forEach((r) => {
    const state = r.stateAtArrival || 'available';
    stateCounts[state] = (stateCounts[state] || 0) + 1;
  });

  // 2. Policy Outcome Breakdown (DERIVED)
  const outcomeCounts: Record<PolicyOutcome, number> = {
    DELIVER: 0,
    DELAY_TO_MEETING_END: 0,
    DELAY_TO_BOUNDARY: 0,
    BATCH: 0,
  };

  decisions.forEach((d) => {
    outcomeCounts[d.outcome] = (outcomeCounts[d.outcome] || 0) + 1;
  });

  // 3. Estimated Avoidable Share (DERIVED)
  const avoidableCount =
    outcomeCounts.DELAY_TO_MEETING_END +
    outcomeCounts.DELAY_TO_BOUNDARY +
    outcomeCounts.BATCH;
  const estimatedAvoidableShare = totalCount > 0 ? avoidableCount / totalCount : 0;

  // 4. Critical Delay Rate & Adjusted Avoidable Share from User Reviews (DERIVED)
  const reviewedTotal = reviews.length;
  const hurtReviews = reviews.filter((rv) => rv.verdict === 'hurt').length;
  const criticalDelayRate = reviewedTotal > 0 ? hurtReviews / reviewedTotal : 0;

  // Adjusted avoidable count subtracts items confirmed as "hurt"
  const adjustedAvoidableCount = Math.max(0, avoidableCount - hurtReviews);
  const adjustedAvoidableShare = totalCount > 0 ? adjustedAvoidableCount / totalCount : 0;

  // 5. Estimated Recovery Exposure Cost (ESTIMATED)
  const focusTimeInterrupts = stateCounts.focus_block + stateCounts.quiet_window;
  const estimatedRecoveryCostMinutes =
    focusTimeInterrupts * config.recoveryMinutesAssumption;

  // 6. Fragmentation Score & Longest Protected Block (DERIVED)
  const { fragmentationScoreMinutes, longestProtectedBlockMinutes } =
    calculateGapsAndFragmentation(records, decisions);

  // 7. Team @channel Cost (ESTIMATED)
  const broadcastCount = records.filter(
    (r) => r.mentionType === 'channel' || r.mentionType === 'here'
  ).length;
  const teamChannelCostEngineerHours =
    (broadcastCount * config.recoveryMinutesAssumption) / 60;

  return {
    totalInterruptions: {
      value: totalCount,
      type: 'MEASURED',
      description: 'Total inbound Slack notification candidates observed',
    },
    interruptionsByState: {
      value: stateCounts,
      type: 'MEASURED',
      description: 'Distribution of interruptions across inferred focus states',
    },
    outcomeBreakdown: {
      value: outcomeCounts,
      type: 'DERIVED',
      description: 'Counterfactual policy delivery decision distribution',
    },
    estimatedAvoidableShare: {
      value: Number(estimatedAvoidableShare.toFixed(3)),
      type: 'DERIVED',
      description: 'Fraction of interruptions that could be delayed or batched',
    },
    adjustedAvoidableShare: {
      value: Number(adjustedAvoidableShare.toFixed(3)),
      type: 'DERIVED',
      description: 'Avoidable share excluding user-confirmed critical delays',
    },
    fragmentationScoreMinutes: {
      value: fragmentationScoreMinutes,
      type: 'DERIVED',
      description: 'Median length of uninterrupted available gaps (minutes)',
    },
    longestProtectedBlockMinutes: {
      value: longestProtectedBlockMinutes,
      type: 'DERIVED',
      description: 'Longest continuous focus block without delivered interruptions',
    },
    estimatedRecoveryCostMinutes: {
      value: estimatedRecoveryCostMinutes,
      type: 'ESTIMATED',
      description: 'Estimated attention residue recovery exposure',
      assumptionNote: `Based on a ${config.recoveryMinutesAssumption}-minute recovery assumption per focus interrupt`,
    },
    criticalDelayRate: {
      value: Number(criticalDelayRate.toFixed(3)),
      type: 'DERIVED',
      description: 'Fraction of sampled delayed events marked as "would have hurt"',
    },
    teamChannelCostEngineerHours: {
      value: Number(teamChannelCostEngineerHours.toFixed(1)),
      type: 'ESTIMATED',
      description: 'Estimated engineering hours impacted by broadcast @channel mentions',
    },
  };
}

function calculateGapsAndFragmentation(
  records: InterruptionRecord[],
  decisions: ShadowDecision[]
): { fragmentationScoreMinutes: number; longestProtectedBlockMinutes: number } {
  if (records.length === 0) {
    return { fragmentationScoreMinutes: 480, longestProtectedBlockMinutes: 480 };
  }

  const decisionMap = new Map<string, PolicyOutcome>();
  decisions.forEach((d) => decisionMap.set(d.interruptionId, d.outcome));

  // Delivered timestamps under counterfactual policy
  const deliveredTimestamps = records
    .filter((r) => decisionMap.get(r.id) === 'DELIVER')
    .map((r) => new Date(r.receivedAt).getTime())
    .sort((a, b) => a - b);

  if (deliveredTimestamps.length <= 1) {
    return { fragmentationScoreMinutes: 240, longestProtectedBlockMinutes: 480 };
  }

  const gaps: number[] = [];
  for (let i = 1; i < deliveredTimestamps.length; i++) {
    const gapMin = (deliveredTimestamps[i] - deliveredTimestamps[i - 1]) / (1000 * 60);
    gaps.push(gapMin);
  }

  gaps.sort((a, b) => a - b);

  const mid = Math.floor(gaps.length / 2);
  const medianGap =
    gaps.length % 2 !== 0 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  const longestGap = gaps.length > 0 ? Math.max(...gaps) : 0;

  return {
    fragmentationScoreMinutes: Math.round(medianGap),
    longestProtectedBlockMinutes: Math.round(longestGap),
  };
}
