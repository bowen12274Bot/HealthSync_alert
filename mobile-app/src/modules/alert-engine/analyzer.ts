import { getActivityBaselineProfile } from './activityBaselineStub'
import {
  appendAlertStatus,
  closeRealtimeAlert,
  createRealtimeAlert,
  getActiveRealtimeAlert,
  getLatestAlertStatus,
  getRecentAlertStatuses,
  getRecentRealtimeHealthRecords,
  updateRealtimeAlertType,
} from './repository'
import {
  calculateRiskScore,
  calculateWindowMetrics,
  determineAlertType,
  mapRiskScoreToAlertStatus,
  resolveAlertTypeTransition,
  resolveNextAlertStatus,
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
  status: AlertLifecycleStatus
  riskScore: number
  statusDescription: string
}): Promise<void> {
  await appendAlertStatus({
    statusId: crypto.randomUUID(),
    alertId: params.alertId,
    status: params.status,
    riskScore: params.riskScore,
    statusTime: params.recordedAt,
    statusDescription: params.statusDescription,
  })

  if (params.status === '已解除' || params.status === '已轉移') {
    await closeRealtimeAlert(params.alertId, params.recordedAt)
  }
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
      const recentStatuses = await getRecentAlertStatuses(activeAlert.alertId, 2)
      const consecutiveRecoveryCount = recentStatuses.filter(
        (statusRecord) => statusRecord.status === '恢復中',
      ).length
      const transition = resolveAlertTypeTransition(
        activeAlert.alertType as AlertType,
        nextDetectedType,
      )

      if (transition === 'same') {
        if (latestStatus !== null) {
          const nextStatus = resolveNextAlertStatus({
            currentStatus: latestStatus.status,
            currentRiskScore: latestStatus.riskScore,
            nextRiskScore: riskScoreResult.riskScore,
            consecutiveRecoveryCount,
          })

          if (latestStatus.status !== nextStatus) {
            await appendAlertStatus({
              statusId: crypto.randomUUID(),
              alertId: activeAlert.alertId,
              status: nextStatus,
              riskScore: riskScoreResult.riskScore,
              statusTime: latestRecord.recordedAt,
              statusDescription: riskScoreResult.triggerReasons.join('、') || '預警事件持續中',
            })
          }
        } else if (status !== null) {
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

        if (latestStatus !== null) {
          const nextStatus = resolveNextAlertStatus({
            currentStatus: latestStatus.status,
            currentRiskScore: latestStatus.riskScore,
            nextRiskScore: riskScoreResult.riskScore,
            consecutiveRecoveryCount,
          })

          if (latestStatus.status !== nextStatus) {
            await appendAlertStatus({
              statusId: crypto.randomUUID(),
              alertId: activeAlert.alertId,
              status: nextStatus,
              riskScore: riskScoreResult.riskScore,
              statusTime: latestRecord.recordedAt,
              statusDescription:
                riskScoreResult.triggerReasons.join('、') || '預警主因升級為綜合生理風險',
            })
          }
        } else if (status !== null) {
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
          status: '已轉移',
          riskScore: riskScoreResult.riskScore,
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
        const recentStatuses = await getRecentAlertStatuses(activeAlert.alertId, 2)
        const consecutiveRecoveryCount = recentStatuses.filter(
          (statusRecord) => statusRecord.status === '恢復中',
        ).length

        if (latestStatus !== null) {
          const nextStatus = resolveNextAlertStatus({
            currentStatus: latestStatus.status,
            currentRiskScore: latestStatus.riskScore,
            nextRiskScore: riskScoreResult.riskScore,
            consecutiveRecoveryCount:
              latestStatus.status === '恢復中'
                ? consecutiveRecoveryCount + 1
                : 1,
          })

          if (latestStatus.status !== nextStatus) {
            await appendResolvedStatus({
              alertId: activeAlert.alertId,
              recordedAt: latestRecord.recordedAt,
              status: nextStatus,
              riskScore: riskScoreResult.riskScore,
              statusDescription:
                nextStatus === '已解除'
                  ? '最新連續 2 次符合恢復條件，事件解除'
                  : '本輪分析已不再達到預警成立門檻，進入恢復中',
            })
          }
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
