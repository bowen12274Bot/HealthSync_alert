export type TrendMode = 'short_term' | 'long_term'
export type TrendMetricKey = 'hr' | 'spo2' | 'hrv'

export interface TrendPoint {
  timestamp: string
  value: number
}

export interface TrendMetricSummary {
  average: number | null
  deltaFromPrevious: number | null
}

export interface TrendMetricReport {
  key: TrendMetricKey
  label: string
  unit: string
  rangeLabel: string
  points: TrendPoint[]
  summary: TrendMetricSummary
}

export interface TrendAlertHint {
  hasAlert: boolean
  count: number
  latestAlertType: string | null
  latestAlertTypeLabel: string | null
  latestRiskScore: number | null
  latestSeverityLabel: string | null
  latestTriggerReason: string | null
  latestWindowStart: string | null
  latestWindowEnd: string | null
}

export interface TrendWindow {
  month?: string
  label: string
  startAt: string
  endAt: string
  previousStartAt: string
  previousEndAt: string
}

export interface TrendReport {
  mode: TrendMode
  window: TrendWindow
  metrics: TrendMetricReport[]
  alertHint?: TrendAlertHint
}
