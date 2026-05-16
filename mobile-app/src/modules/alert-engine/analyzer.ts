import { getActivityBaselineProfile } from './activityBaselineStub'
import {
  appendAlertStatus,
  createRealtimeAlert,
  getLatestAlertStatus,
  getLatestRealtimeAlert,
  getRecentRealtimeHealthRecords,
} from './repository'
import {
  calculateRiskScore,
  calculateWindowMetrics,
  determineAlertType,
  mapRiskScoreToAlertStatus,
} from './rules'

import type {
  AlertAnalysisResult,
  AlertLifecycleStatus,
  AlertType,
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

async function hasActiveRealtimeAlert(): Promise<boolean> {
  const latestAlert = await getLatestRealtimeAlert()

  if (latestAlert === null) {
    return false
  }

  const latestStatus = await getLatestAlertStatus(latestAlert.alertId)
  return latestStatus !== null && latestStatus.status !== '已解除'
}

async function createInitialAlertRecords(params: {
  alertType: AlertType
  status: AlertLifecycleStatus
  riskScore: number
  triggerReasons: string[]
  recordedAt: string
}): Promise<void> {
  const alertId = crypto.randomUUID()
  const statusId = crypto.randomUUID()
  const triggerReason = params.triggerReasons.join('、')

  await createRealtimeAlert({
    alertId,
    alertType: params.alertType,
    initialRiskScore: params.riskScore,
    triggerReason,
    detectionStartTime: params.recordedAt,
    detectionEndTime: null,
    firstOccurredAt: params.recordedAt,
    syncStatus: 'pending',
  })

  await appendAlertStatus({
    statusId,
    alertId,
    status: params.status,
    riskScore: params.riskScore,
    statusTime: params.recordedAt,
    statusDescription: triggerReason || '分析模組偵測到預警條件成立',
  })
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
  const alertType = determineAlertType(metrics, baseline, currentActivityLevel)
  const status = mapRiskScoreToAlertStatus(riskScoreResult.riskScore)
  const latestRecord = records.at(-1)
  const shouldTriggerAlert =
    riskScoreResult.riskScore >= 3 && alertType !== null && status !== null

  if (shouldTriggerAlert && latestRecord !== undefined) {
    const activeAlertExists = await hasActiveRealtimeAlert()

    if (!activeAlertExists) {
      await createInitialAlertRecords({
        alertType,
        status,
        riskScore: riskScoreResult.riskScore,
        triggerReasons: riskScoreResult.triggerReasons,
        recordedAt: latestRecord.recordedAt,
      })
    }
  }

  return {
    analysisStage,
    sampleCount,
    currentActivityLevel,
    baseline,
    metrics,
    riskScore: riskScoreResult.riskScore,
    triggerReasons: riskScoreResult.triggerReasons,
    shouldTriggerAlert,
  }
}

export {
  FULL_ANALYSIS_SAMPLE_THRESHOLD,
  WARMING_UP_SAMPLE_THRESHOLD,
}
