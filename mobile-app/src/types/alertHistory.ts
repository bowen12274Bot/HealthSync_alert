export type AlertHistorySourceType = 'realtime' | 'long_term'

export type AlertDisplaySeverity = 'mild' | 'moderate' | 'high'

export interface AlertHistoryRecord {
  recordId: string
  sourceType: AlertHistorySourceType
  sourceTable: 'alert_histories' | 'long_term_alerts'
  sourceKey: string
  alertType: string
  alertTypeLabel: string
  title: string
  summary: string
  historyTypeLabel: string
  displaySeverity: AlertDisplaySeverity
  displaySeverityLabel: string
  status: string
  statusLabel: string
  occurredAt: string
  resolvedAt: string | null
  timeRangeLabel: string
  createdAt: string
}

export interface RealtimeStatusHistoryItem {
  status: string
  statusLabel: string
  riskScore: number
  statusTime: string
  statusDescription: string
}

export interface AlertHistoryDetailBase extends AlertHistoryRecord {
  triggerReason: string
}

export interface RealtimeAlertHistoryDetail extends AlertHistoryDetailBase {
  sourceType: 'realtime'
  alertId: string
  maxRiskScore: number
  maxSeverityLevel: string
  firstOccurredAt: string
  lastAbnormalAt: string | null
  durationSeconds: number | null
  statusChangeCount: number
  isWorsened: boolean
  statusHistory: RealtimeStatusHistoryItem[]
}

export interface LongTermAlertHistoryDetail extends AlertHistoryDetailBase {
  sourceType: 'long_term'
  longTermAlertId: number
  riskScore: number
  windowStart: string
  windowEnd: string
  updatedAt: string
}

export type AlertHistoryDetail = RealtimeAlertHistoryDetail | LongTermAlertHistoryDetail
