import { getActivityBaselineProfile } from './activityBaselineStub'
import {
  appendAlertStatus,
  closeRealtimeAlert,
  createRealtimeAlert,
  getActiveRealtimeAlert,
  getLatestAlertStatus,
  getRecentRealtimeHealthRecords,
  updateRealtimeAlertType,
} from './repository'
import {
  calculateRiskScore,
  calculateWindowMetrics,
  determineAlertType,
  mapRiskScoreToAlertStatus,
  resolveAlertTypeTransition,
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

async function appendResolvedStatus(params: {
  alertId: string
  recordedAt: string
  statusDescription: string
}): Promise<void> {
  await appendAlertStatus({
    statusId: crypto.randomUUID(),
    alertId: params.alertId,
    status: '已解除',
    riskScore: 0,
    statusTime: params.recordedAt,
    statusDescription: params.statusDescription,
  })

  await closeRealtimeAlert(params.alertId, params.recordedAt)
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
  const candidateAlertType = determineAlertType(metrics, baseline, currentActivityLevel)
  const status = mapRiskScoreToAlertStatus(riskScoreResult.riskScore)
  const latestRecord = records.at(-1)
  const nextDetectedType =
    riskScoreResult.riskScore >= 3 ? candidateAlertType : null
  const shouldTriggerAlert =
    riskScoreResult.riskScore >= 3 && nextDetectedType !== null && status !== null

  if (shouldTriggerAlert && latestRecord !== undefined) {
    const activeAlert = await getActiveRealtimeAlert()

    if (activeAlert === null) {
      await createInitialAlertRecords({
        alertType: nextDetectedType,
        status,
        riskScore: riskScoreResult.riskScore,
        triggerReasons: riskScoreResult.triggerReasons,
        recordedAt: latestRecord.recordedAt,
      })
    } else {
      const latestStatus = await getLatestAlertStatus(activeAlert.alertId)
      const transition = resolveAlertTypeTransition(
        activeAlert.alertType as AlertType,
        nextDetectedType,
      )

      if (transition === 'same') {
        if (status !== null && latestStatus?.status !== status) {
          await appendAlertStatus({
            statusId: crypto.randomUUID(),
            alertId: activeAlert.alertId,
            status,
            riskScore: riskScoreResult.riskScore,
            statusTime: latestRecord.recordedAt,
            statusDescription: riskScoreResult.triggerReasons.join('、') || '預警事件持續中',
          })
        }
      }

      if (transition === 'upgrade') {
        await updateRealtimeAlertType(activeAlert.alertId, nextDetectedType)

        if (status !== null && latestStatus?.status !== status) {
          await appendAlertStatus({
            statusId: crypto.randomUUID(),
            alertId: activeAlert.alertId,
            status,
            riskScore: riskScoreResult.riskScore,
            statusTime: latestRecord.recordedAt,
            statusDescription:
              riskScoreResult.triggerReasons.join('、') || '預警主因升級為綜合生理風險',
          })
        }
      }

      if (transition === 'replace') {
        await appendResolvedStatus({
          alertId: activeAlert.alertId,
          recordedAt: latestRecord.recordedAt,
          statusDescription: '原主因不再成立，改由新預警事件承接',
        })

        await createInitialAlertRecords({
          alertType: nextDetectedType,
          status,
          riskScore: riskScoreResult.riskScore,
          triggerReasons: riskScoreResult.triggerReasons,
          recordedAt: latestRecord.recordedAt,
        })
      }
    }
  } else if (latestRecord !== undefined) {
    const activeAlert = await getActiveRealtimeAlert()

    if (activeAlert !== null) {
      const transition = resolveAlertTypeTransition(activeAlert.alertType as AlertType, null)

      if (transition === 'resolve') {
        const latestStatus = await getLatestAlertStatus(activeAlert.alertId)

        if (latestStatus?.status !== '已解除') {
          await appendResolvedStatus({
            alertId: activeAlert.alertId,
            recordedAt: latestRecord.recordedAt,
            statusDescription: '本輪分析已不再達到預警成立門檻',
          })
        }
      }
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
