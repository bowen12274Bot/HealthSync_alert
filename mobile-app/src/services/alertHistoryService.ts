import { getApiBaseUrl } from './apiClient'

import type { AlertHistoryDetail, AlertHistoryRecord } from '@/types/alertHistory'

export class AlertHistoryServiceError extends Error {
  readonly code: 'network' | 'unauthorized' | 'not_found' | 'http'
  readonly status?: number

  constructor(message: string, code: AlertHistoryServiceError['code'], status?: number) {
    super(message)
    this.name = 'AlertHistoryServiceError'
    this.code = code
    this.status = status
  }
}

interface AlertHistoryListApiResponse {
  records: AlertHistoryRecordApiResponse[]
  server_generated_at: string
}

interface AlertHistoryDetailApiEnvelopeResponse {
  detail: AlertHistoryDetailApiResponse
}

interface AlertHistoryRecordApiResponse {
  record_id: string
  source_type: 'realtime' | 'long_term'
  source_table: 'alert_histories' | 'long_term_alerts'
  source_key: string
  alert_type: string
  alert_type_label: string
  title: string
  summary: string
  history_type_label: string
  display_severity: 'mild' | 'moderate' | 'high'
  display_severity_label: string
  status: string
  status_label: string
  occurred_at: string
  resolved_at: string | null
  time_range_label: string
  created_at: string
}

interface AlertHistoryDetailApiResponse extends AlertHistoryRecordApiResponse {
  trigger_reason: string
  alert_id?: string | null
  max_risk_score?: number | null
  max_severity_level?: string | null
  first_occurred_at?: string | null
  last_abnormal_at?: string | null
  duration_seconds?: number | null
  status_change_count?: number | null
  is_worsened?: boolean | null
  status_history?: Array<{
    status: string
    status_label: string
    risk_score: number
    status_time: string
    status_description: string
  }> | null
  long_term_alert_id?: number | null
  risk_score?: number | null
  window_start?: string | null
  window_end?: string | null
  updated_at?: string | null
}

function createNetworkError(): AlertHistoryServiceError {
  return new AlertHistoryServiceError('目前無法連線到伺服器，請稍後再試', 'network')
}

async function performAuthenticatedRequest(path: string, token: string): Promise<Response> {
  try {
    return await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw createNetworkError()
  }
}

function mapRecord(response: AlertHistoryRecordApiResponse): AlertHistoryRecord {
  return {
    recordId: response.record_id,
    sourceType: response.source_type,
    sourceTable: response.source_table,
    sourceKey: response.source_key,
    alertType: response.alert_type,
    alertTypeLabel: response.alert_type_label,
    title: response.title,
    summary: response.summary,
    historyTypeLabel: response.history_type_label,
    displaySeverity: response.display_severity,
    displaySeverityLabel: response.display_severity_label,
    status: response.status,
    statusLabel: response.status_label,
    occurredAt: response.occurred_at,
    resolvedAt: response.resolved_at,
    timeRangeLabel: response.time_range_label,
    createdAt: response.created_at,
  }
}

function mapDetail(response: AlertHistoryDetailApiResponse): AlertHistoryDetail {
  const base = {
    ...mapRecord(response),
    triggerReason: response.trigger_reason,
  }

  if (response.source_type === 'realtime') {
    return {
      ...base,
      sourceType: 'realtime',
      alertId: response.alert_id ?? '',
      maxRiskScore: response.max_risk_score ?? 0,
      maxSeverityLevel: response.max_severity_level ?? '',
      firstOccurredAt: response.first_occurred_at ?? response.occurred_at,
      lastAbnormalAt: response.last_abnormal_at ?? null,
      durationSeconds: response.duration_seconds ?? null,
      statusChangeCount: response.status_change_count ?? 0,
      isWorsened: response.is_worsened ?? false,
      statusHistory: (response.status_history ?? []).map((item) => ({
        status: item.status,
        statusLabel: item.status_label,
        riskScore: item.risk_score,
        statusTime: item.status_time,
        statusDescription: item.status_description,
      })),
    }
  }

  return {
    ...base,
    sourceType: 'long_term',
    longTermAlertId: response.long_term_alert_id ?? 0,
    riskScore: response.risk_score ?? 0,
    windowStart: response.window_start ?? response.occurred_at,
    windowEnd: response.window_end ?? response.resolved_at ?? response.occurred_at,
    updatedAt: response.updated_at ?? response.created_at,
  }
}

export async function fetchAlertHistoryRecords(
  token: string,
  limit: number,
): Promise<AlertHistoryRecord[]> {
  const response = await performAuthenticatedRequest(
    `/alerts/history?limit=${encodeURIComponent(String(limit))}`,
    token,
  )

  if (response.status === 401) {
    throw new AlertHistoryServiceError('登入狀態已失效', 'unauthorized', 401)
  }

  if (!response.ok) {
    throw new AlertHistoryServiceError(
      `取得預警紀錄失敗：${response.status}`,
      'http',
      response.status,
    )
  }

  const payload = (await response.json()) as AlertHistoryListApiResponse
  return payload.records.map(mapRecord)
}

export async function fetchAlertHistoryDetail(
  token: string,
  recordId: string,
): Promise<AlertHistoryDetail> {
  const response = await performAuthenticatedRequest(
    `/alerts/history/${encodeURIComponent(recordId)}`,
    token,
  )

  if (response.status === 401) {
    throw new AlertHistoryServiceError('登入狀態已失效', 'unauthorized', 401)
  }

  if (response.status === 404) {
    throw new AlertHistoryServiceError('找不到該筆預警紀錄', 'not_found', 404)
  }

  if (!response.ok) {
    throw new AlertHistoryServiceError(
      `取得預警詳情失敗：${response.status}`,
      'http',
      response.status,
    )
  }

  const payload = (await response.json()) as AlertHistoryDetailApiEnvelopeResponse
  return mapDetail(payload.detail)
}
