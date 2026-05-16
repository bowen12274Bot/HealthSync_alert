import { getActivityBaselineProfile } from './activityBaselineStub'
import { getRecentRealtimeHealthRecords } from './repository'
import { calculateRiskScore, calculateWindowMetrics } from './rules'

import type {
  AlertAnalysisResult,
  AnalysisStage,
  RealtimeHealthRecord,
} from './types'

const WARMING_UP_SAMPLE_THRESHOLD = 6
const FULL_ANALYSIS_SAMPLE_THRESHOLD = 12

export function determineAnalysisStage(sampleCount: number): AnalysisStage {
  if (sampleCount < WARMING_UP_SAMPLE_THRESHOLD) {
    return 'warming_up'
  }

  if (sampleCount < FULL_ANALYSIS_SAMPLE_THRESHOLD) {
    return 'partial_analysis'
  }

  return 'full_analysis'
}

function getCurrentActivityLevel(
  records: RealtimeHealthRecord[],
): RealtimeHealthRecord['activityLevel'] | null {
  const latestRecord = records.at(-1)
  return latestRecord?.activityLevel ?? null
}

export async function analyzeLatestWindow(): Promise<AlertAnalysisResult> {
  const records = await getRecentRealtimeHealthRecords(FULL_ANALYSIS_SAMPLE_THRESHOLD)
  const sampleCount = records.length
  const analysisStage = determineAnalysisStage(sampleCount)
  const currentActivityLevel = getCurrentActivityLevel(records)
  const baseline =
    currentActivityLevel === null ? null : getActivityBaselineProfile(currentActivityLevel)
  const metrics = calculateWindowMetrics(records)
  const riskScoreResult = calculateRiskScore(analysisStage, metrics, baseline)

  return {
    analysisStage,
    sampleCount,
    currentActivityLevel,
    baseline,
    metrics,
    riskScore: riskScoreResult.riskScore,
    triggerReasons: riskScoreResult.triggerReasons,
    shouldTriggerAlert: riskScoreResult.riskScore > 0,
  }
}

export {
  FULL_ANALYSIS_SAMPLE_THRESHOLD,
  WARMING_UP_SAMPLE_THRESHOLD,
}
