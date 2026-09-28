import {
  CalibrationAnalysis,
  CalibrationFocusStateItem,
  CalibrationObservation,
  CalibrationOutcomeItem,
  CalibrationReasonCodeItem,
  CalibrationSignal,
  CalibrationThresholds,
  DecisionReview,
  FocusState,
  HarmCategory,
  HarmCategoryAggregationItem,
  PolicyOutcome,
  PolicyVersion,
  ReasonCode,
  SampleSufficiency,
} from './types';

export const DEFAULT_MIN_CALIBRATION_SAMPLES = 5;
export const DEFAULT_LOW_DISAGREEMENT_MAX = 0.1;
export const DEFAULT_ELEVATED_DISAGREEMENT_MAX = 0.3;

export function runCalibrationAnalysis(
  reviews: DecisionReview[],
  userId: string,
  options?: {
    policyVersion?: PolicyVersion;
    periodStart?: string;
    periodEnd?: string;
    thresholds?: Partial<CalibrationThresholds>;
  }
): CalibrationAnalysis {
  const policyVersion = options?.policyVersion || 'shadow-v0.1';
  const periodEnd = options?.periodEnd || new Date().toISOString();
  const periodStart =
    options?.periodStart ||
    new Date(new Date(periodEnd).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const thresholds: CalibrationThresholds = {
    minCalibrationSamples:
      options?.thresholds?.minCalibrationSamples ?? DEFAULT_MIN_CALIBRATION_SAMPLES,
    lowDisagreementMax:
      options?.thresholds?.lowDisagreementMax ?? DEFAULT_LOW_DISAGREEMENT_MAX,
    elevatedDisagreementMax:
      options?.thresholds?.elevatedDisagreementMax ?? DEFAULT_ELEVATED_DISAGREEMENT_MAX,
  };

  const reasonMap = new Map<
    string,
    {
      total: number;
      agree: number;
      unsure: number;
      disagree: number;
      harmMap: Map<string, number>;
    }
  >();

  const stateMap = new Map<
    string,
    { total: number; agree: number; unsure: number; disagree: number }
  >();

  const outcomeMap = new Map<
    string,
    { total: number; agree: number; unsure: number; disagree: number }
  >();

  const overallHarmMap = new Map<string, number>();

  for (const r of reviews) {
    const isAgree = r.verdict === 'fine' || (r.verdict as any) === 'AGREE';
    const isUnsure = r.verdict === 'unsure' || (r.verdict as any) === 'UNSURE';
    const isDisagree = r.verdict === 'hurt' || (r.verdict as any) === 'DISAGREE';

    if (r.reasonCode) {
      if (!reasonMap.has(r.reasonCode)) {
        reasonMap.set(r.reasonCode, {
          total: 0,
          agree: 0,
          unsure: 0,
          disagree: 0,
          harmMap: new Map<string, number>(),
        });
      }
      const entry = reasonMap.get(r.reasonCode)!;
      entry.total++;
      if (isAgree) entry.agree++;
      else if (isUnsure) entry.unsure++;
      else if (isDisagree) entry.disagree++;

      if (r.harmCategory) {
        entry.harmMap.set(r.harmCategory, (entry.harmMap.get(r.harmCategory) || 0) + 1);
      }
    }

    if (r.focusState) {
      if (!stateMap.has(r.focusState)) {
        stateMap.set(r.focusState, { total: 0, agree: 0, unsure: 0, disagree: 0 });
      }
      const entry = stateMap.get(r.focusState)!;
      entry.total++;
      if (isAgree) entry.agree++;
      else if (isUnsure) entry.unsure++;
      else if (isDisagree) entry.disagree++;
    }

    if (r.outcome) {
      if (!outcomeMap.has(r.outcome)) {
        outcomeMap.set(r.outcome, { total: 0, agree: 0, unsure: 0, disagree: 0 });
      }
      const entry = outcomeMap.get(r.outcome)!;
      entry.total++;
      if (isAgree) entry.agree++;
      else if (isUnsure) entry.unsure++;
      else if (isDisagree) entry.disagree++;
    }

    if (r.harmCategory) {
      overallHarmMap.set(r.harmCategory, (overallHarmMap.get(r.harmCategory) || 0) + 1);
    }
  }

  const classifySignal = (
    total: number,
    disagree: number
  ): { sampleSufficiency: SampleSufficiency; calibrationSignal: CalibrationSignal; rate: number } => {
    const rate = total > 0 ? Number((disagree / total).toFixed(3)) : 0;
    if (total < thresholds.minCalibrationSamples) {
      return {
        sampleSufficiency: 'INSUFFICIENT_SAMPLE',
        calibrationSignal: 'INSUFFICIENT_SAMPLE',
        rate,
      };
    }
    const sampleSufficiency: SampleSufficiency = 'SUFFICIENT_SAMPLE';
    let calibrationSignal: CalibrationSignal = 'LOW_DISAGREEMENT';
    if (rate > thresholds.elevatedDisagreementMax) {
      calibrationSignal = 'HIGH_DISAGREEMENT';
    } else if (rate > thresholds.lowDisagreementMax) {
      calibrationSignal = 'ELEVATED_DISAGREEMENT';
    }
    return { sampleSufficiency, calibrationSignal, rate };
  };

  const observations: CalibrationObservation[] = [];

  const byReasonCode: CalibrationReasonCodeItem[] = [];
  for (const [rc, counts] of reasonMap.entries()) {
    const { sampleSufficiency, calibrationSignal, rate } = classifySignal(counts.total, counts.disagree);
    const harmCategories: HarmCategoryAggregationItem[] = Array.from(counts.harmMap.entries())
      .map(([harmCategory, count]) => ({ harmCategory: harmCategory as HarmCategory, count }))
      .sort((a, b) => b.count - a.count || String(a.harmCategory).localeCompare(String(b.harmCategory)));

    byReasonCode.push({
      reasonCode: rc as ReasonCode,
      totalReviews: counts.total,
      agreeCount: counts.agree,
      unsureCount: counts.unsure,
      disagreeCount: counts.disagree,
      disagreementRate: rate,
      sampleSufficiency,
      calibrationSignal,
      harmCategories,
    });

    if (sampleSufficiency === 'INSUFFICIENT_SAMPLE') {
      observations.push({
        dimension: 'reasonCode',
        key: rc,
        message: `${rc} has ${counts.total} reviewed samples, which is below the minimum threshold of ${thresholds.minCalibrationSamples} required for calibration evidence.`,
        severity: 'INFO',
      });
    } else {
      const severity =
        calibrationSignal === 'HIGH_DISAGREEMENT'
          ? 'CRITICAL'
          : calibrationSignal === 'ELEVATED_DISAGREEMENT'
          ? 'WARNING'
          : 'INFO';
      observations.push({
        dimension: 'reasonCode',
        key: rc,
        message: `${rc} has ${counts.total} reviewed samples with a disagreement rate of ${rate} (${counts.disagree} disagree).`,
        severity,
      });
    }
  }

  byReasonCode.sort(
    (a, b) => b.totalReviews - a.totalReviews || String(a.reasonCode).localeCompare(String(b.reasonCode))
  );

  const byFocusState: CalibrationFocusStateItem[] = [];
  for (const [fs, counts] of stateMap.entries()) {
    const { sampleSufficiency, calibrationSignal, rate } = classifySignal(counts.total, counts.disagree);
    byFocusState.push({
      focusState: fs as FocusState,
      totalReviews: counts.total,
      agreeCount: counts.agree,
      unsureCount: counts.unsure,
      disagreeCount: counts.disagree,
      disagreementRate: rate,
      sampleSufficiency,
      calibrationSignal,
    });
  }
  byFocusState.sort(
    (a, b) => b.totalReviews - a.totalReviews || String(a.focusState).localeCompare(String(b.focusState))
  );

  const byOutcome: CalibrationOutcomeItem[] = [];
  for (const [oc, counts] of outcomeMap.entries()) {
    const { sampleSufficiency, calibrationSignal, rate } = classifySignal(counts.total, counts.disagree);
    byOutcome.push({
      outcome: oc as PolicyOutcome,
      totalReviews: counts.total,
      agreeCount: counts.agree,
      unsureCount: counts.unsure,
      disagreeCount: counts.disagree,
      disagreementRate: rate,
      sampleSufficiency,
      calibrationSignal,
    });
  }
  byOutcome.sort(
    (a, b) => b.totalReviews - a.totalReviews || String(a.outcome).localeCompare(String(b.outcome))
  );

  const harmCategories: HarmCategoryAggregationItem[] = Array.from(overallHarmMap.entries())
    .map(([harmCategory, count]) => ({ harmCategory: harmCategory as HarmCategory, count }))
    .sort((a, b) => b.count - a.count || String(a.harmCategory).localeCompare(String(b.harmCategory)));

  if (reviews.length === 0) {
    observations.push({
      dimension: 'overall',
      key: 'totalReviews',
      message: 'Zero reviewed samples available in the specified observation window.',
      severity: 'INFO',
    });
  }

  return {
    userId,
    policyVersion: policyVersion as PolicyVersion,
    periodStart,
    periodEnd,
    totalReviews: reviews.length,
    thresholds,
    byReasonCode,
    byFocusState,
    byOutcome,
    harmCategories,
    observations,
  };
}
