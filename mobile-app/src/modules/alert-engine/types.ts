import type {
  ActivityLevel,
  RawHealthRecord as RealtimeHealthRecord,
} from '@/modules/health-simulation'

export type { ActivityLevel, RealtimeHealthRecord }

export interface ActivityBaselineProfile {
  activityLevel: ActivityLevel
  targetHr: number
  targetHrv: number
  targetSpO2: number
}

export type AnalysisStage = 'warming_up' | 'partial_analysis' | 'full_analysis'

export interface WindowMetrics {
  sampleCount: number

  hrMean: number
  hrStd: number
  hrTrend: number

  hrvMean: number
  hrvStd: number
  hrvTrend: number

  spO2Mean: number
  spO2Std: number
  spO2Trend: number
}

export interface AlertAnalysisResult {
  analysisStage: AnalysisStage
  sampleCount: number
  currentActivityLevel: ActivityLevel | null
  baseline: ActivityBaselineProfile | null
  metrics: WindowMetrics | null
  riskScore: number
  triggerReasons: string[]
  shouldTriggerAlert: boolean
}

export interface RiskScoreResult {
  riskScore: number
  triggerReasons: string[]
}

export type AlertType =
  | 'spo2_risk'
  | 'physiological_stress'
  | 'combined_physiological_risk'

export type AlertLifecycleStatus = '觀察中' | '注意' | '警戒' | '恢復中' | '已解除'

export interface RealtimeAlertRecord {
  alertId: string
  alertType: string
  initialRiskScore: number
  triggerReason: string
  detectionStartTime: string
  detectionEndTime: string | null
  firstOccurredAt: string
  syncStatus: 'pending' | 'synced'
}

export interface AlertStatusRecord {
  statusId: string
  alertId: string
  status: AlertLifecycleStatus
  riskScore: number
  statusTime: string
  statusDescription: string
}
