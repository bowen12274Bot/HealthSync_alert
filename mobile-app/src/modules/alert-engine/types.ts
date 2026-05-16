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
