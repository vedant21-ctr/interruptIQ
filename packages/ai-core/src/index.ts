import { InformationPayload, UserContextState, DecisionResponse } from '@interrupt-iq/shared';

/**
 * Baseline Rule engine for evaluating notification priority and context.
 */
export function evaluateHeuristics(
  payload: InformationPayload,
  context: UserContextState
): DecisionResponse {
  // Safe default: bypass urgent triggers
  if (payload.category === 'urgent') {
    return {
      decision: 'NOTIFY NOW',
      reason: 'Urgent notification bypass rule matched.',
      confidence: 1.0,
      signalsUsed: ['category'],
    };
  }

  // System offline logic
  if (context.network === 'offline') {
    return {
      decision: 'IGNORE',
      reason: 'Device is offline. Discarding non-critical notifications.',
      confidence: 1.0,
      signalsUsed: ['network'],
    };
  }

  // Battery conservation
  if (context.battery < 15 && !context.charging) {
    return {
      decision: 'IGNORE',
      reason: 'Critical battery level. Conserving power resources.',
      confidence: 0.95,
      signalsUsed: ['battery', 'charging'],
    };
  }

  // Default evaluation fallback
  return {
    decision: 'DELAY',
    reason: 'Standard focus window rule applied.',
    confidence: 0.8,
    signalsUsed: ['activity', 'timeOfDay'],
  };
}
