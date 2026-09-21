import { FocusState, InterruptionRecord, ShadowDecision, UserSettings } from './types';

export interface ContextBoundaryInfo {
  meetingEndAt?: string;
  nextFocusBoundaryAt?: string;
  nextBatchWindowAt?: string;
}

/**
 * Pure deterministic function evaluating the counterfactual Shadow Policy.
 * Zero database, network, Redis, LLM, or global state side effects.
 */
export function evaluateShadowPolicy(
  interruption: InterruptionRecord,
  focusState: FocusState,
  config: UserSettings,
  boundaryInfo: ContextBoundaryInfo = {}
): ShadowDecision {
  const evaluatedAt = interruption.receivedAt;
  const policyVersion = 'shadow-v0.1';

  // Rule 1: Never-suppress VIP check
  const isVip =
    interruption.senderTier === 'vip' ||
    config.vipUserIds.includes(interruption.senderId) ||
    config.vipSenders.includes(interruption.senderId);

  if (isVip) {
    return {
      interruptionId: interruption.id,
      userId: interruption.userId,
      outcome: 'DELIVER',
      reasonCode: 'NEVER_SUPPRESS_VIP',
      policyVersion,
      evaluatedAt,
      wouldDeliverAt: evaluatedAt,
    };
  }

  // Rule 2: Never-suppress Incident Channel
  if (interruption.isIncidentChannel) {
    return {
      interruptionId: interruption.id,
      userId: interruption.userId,
      outcome: 'DELIVER',
      reasonCode: 'NEVER_SUPPRESS_INCIDENT',
      policyVersion,
      evaluatedAt,
      wouldDeliverAt: evaluatedAt,
    };
  }

  // Rule 3: State is Available
  if (focusState === 'available') {
    return {
      interruptionId: interruption.id,
      userId: interruption.userId,
      outcome: 'DELIVER',
      reasonCode: 'STATE_AVAILABLE',
      policyVersion,
      evaluatedAt,
      wouldDeliverAt: evaluatedAt,
    };
  }

  // Rule 4: State is Out of Office / Outside Working Hours Boundary
  if (focusState === 'ooo') {
    return {
      interruptionId: interruption.id,
      userId: interruption.userId,
      outcome: 'DELIVER',
      reasonCode: 'STATE_OOO_BOUNDARY',
      policyVersion,
      evaluatedAt,
      wouldDeliverAt: evaluatedAt,
    };
  }

  // Rule 5: Direct mention or DM with urgency signal
  const isDirectTarget =
    interruption.channelType === 'dm' || interruption.mentionType === 'direct';

  if (isDirectTarget && interruption.hasUrgencySignal) {
    return {
      interruptionId: interruption.id,
      userId: interruption.userId,
      outcome: 'DELIVER',
      reasonCode: 'DIRECT_MENTION_URGENT',
      policyVersion,
      evaluatedAt,
      wouldDeliverAt: evaluatedAt,
    };
  }

  // Rule 6: State is Meeting -> Delay to Meeting End
  if (focusState === 'meeting') {
    const meetingEnd = boundaryInfo.meetingEndAt || evaluatedAt;
    return {
      interruptionId: interruption.id,
      userId: interruption.userId,
      outcome: 'DELAY_TO_MEETING_END',
      reasonCode: 'MEETING_DELAY_TO_END',
      policyVersion,
      evaluatedAt,
      wouldDeliverAt: meetingEnd,
    };
  }

  // Rule 7: Focus Block / Quiet Window with @channel or @here -> Batch
  const isBroadcast =
    interruption.mentionType === 'channel' || interruption.mentionType === 'here';

  if ((focusState === 'focus_block' || focusState === 'quiet_window') && isBroadcast) {
    const batchWindow = boundaryInfo.nextBatchWindowAt || addMinutesIso(evaluatedAt, 120);
    return {
      interruptionId: interruption.id,
      userId: interruption.userId,
      outcome: 'BATCH',
      reasonCode: 'FOCUS_BLOCK_BATCH_CHANNEL',
      policyVersion,
      evaluatedAt,
      wouldDeliverAt: batchWindow,
    };
  }

  // Rule 8: Focus Block or Quiet Window -> Delay to Next Focus Boundary
  const focusBoundary = boundaryInfo.nextFocusBoundaryAt || addMinutesIso(evaluatedAt, 30);
  const reasonCode =
    focusState === 'focus_block'
      ? 'FOCUS_BLOCK_DELAY_BOUNDARY'
      : 'QUIET_WINDOW_DELAY_BOUNDARY';

  return {
    interruptionId: interruption.id,
    userId: interruption.userId,
    outcome: 'DELAY_TO_BOUNDARY',
    reasonCode,
    policyVersion,
    evaluatedAt,
    wouldDeliverAt: focusBoundary,
  };
}

function addMinutesIso(isoString: string, minutes: number): string {
  const d = new Date(isoString);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}
