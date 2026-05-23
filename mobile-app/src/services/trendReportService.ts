import { Capacitor } from '@capacitor/core'

import { getDatabaseConnection } from '@/db/sqlite'
import { getApiBaseUrl } from '@/services/apiClient'

import type {
  TrendAlertHint,
  TrendMetricKey,
  TrendMetricReport,
  TrendMetricSummary,
  TrendPoint,
  TrendReport,
  TrendWindow,
} from '@/types/trendReport'

const DAY_MS = 24 * 60 * 60 * 1000

const METRIC_DEFINITIONS: Record<TrendMetricKey, { label: string; unit: string }> = {
  hr: { label: '心率趨勢', unit: 'bpm' },
  spo2: { label: '血氧趨勢', unit: '%' },
  hrv: { label: 'HRV 趨勢', unit: 'ms' },
}

type ShortTermMetricAccumulator = Record<TrendMetricKey, number[]>

interface ShortTermRecordRow {
  window_start: string
  avg_hr: number
  avg_spo2: number
  avg_hrv: number
}

interface LongTermTrendApiResponse {
  mode: 'long_term'
  window: {
    month: string
    label: string
    start_at: string
    end_at: string
    previous_start_at: string
    previous_end_at: string
  }
  hr: LongTermTrendMetricApiResponse
  spo2: LongTermTrendMetricApiResponse
  hrv: LongTermTrendMetricApiResponse
  alert_hint: {
    has_alert: boolean
    count: number
    latest_alert_type: string | null
    latest_alert_type_label: string | null
    latest_risk_score: number | null
    latest_severity_label: string | null
    latest_trigger_reason: string | null
    latest_window_start: string | null
    latest_window_end: string | null
  }
}

interface LongTermTrendMetricApiResponse {
  points: Array<{
    timestamp: string
    value: number
  }>
  summary: {
    average: number | null
    delta_from_previous: number | null
  }
}

export class TrendReportServiceError extends Error {
  readonly code: 'network' | 'unauthorized' | 'http'
  readonly status?: number

  constructor(message: string, code: TrendReportServiceError['code'], status?: number) {
    super(message)
    this.name = 'TrendReportServiceError'
    this.code = code
    this.status = status
  }
}

function formatShortTermWindowLabel(startAt: Date, endAt: Date): string {
  return `${startAt.getMonth() + 1}/${startAt.getDate()} - ${endAt.getMonth() + 1}/${endAt.getDate()}`
}

function buildEmptySummary(): TrendMetricSummary {
  return {
    average: null,
    deltaFromPrevious: null,
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
}

function buildMetricReport(
  key: TrendMetricKey,
  rangeLabel: string,
  points: TrendPoint[],
  currentValues: number[],
  previousValues: number[],
): TrendMetricReport {
  const currentAverage = average(currentValues)
  const previousAverage = average(previousValues)
  const deltaFromPrevious =
    currentAverage !== null && previousAverage !== null
      ? Number((currentAverage - previousAverage).toFixed(2))
      : null

  return {
    key,
    label: METRIC_DEFINITIONS[key].label,
    unit: METRIC_DEFINITIONS[key].unit,
    rangeLabel,
    points,
    summary: {
      average: currentAverage,
      deltaFromPrevious,
    },
  }
}

function initialAccumulator(): ShortTermMetricAccumulator {
  return {
    hr: [],
    spo2: [],
    hrv: [],
  }
}

export async function buildShortTermTrendReport(): Promise<TrendReport> {
  if (!Capacitor.isNativePlatform()) {
    const now = new Date()
    return {
      mode: 'short_term',
      window: {
        label: '最近 7 天',
        startAt: now.toISOString(),
        endAt: now.toISOString(),
        previousStartAt: now.toISOString(),
        previousEndAt: now.toISOString(),
      },
      metrics: (Object.keys(METRIC_DEFINITIONS) as TrendMetricKey[]).map((key) => ({
        key,
        label: METRIC_DEFINITIONS[key].label,
        unit: METRIC_DEFINITIONS[key].unit,
        rangeLabel: '最近 7 天',
        points: [],
        summary: buildEmptySummary(),
      })),
    }
  }

  const now = new Date()
  const currentWindowStart = new Date(now.getTime() - 7 * DAY_MS)
  const previousWindowStart = new Date(currentWindowStart.getTime() - 7 * DAY_MS)
  const previousWindowEnd = new Date(currentWindowStart.getTime() - 1)

  const db = await getDatabaseConnection()
  const result = await db.query(
    `
      SELECT window_start, avg_hr, avg_spo2, avg_hrv
        FROM periodic_health_records
       WHERE window_start >= ? AND window_start <= ?
       ORDER BY window_start ASC
    `,
    [previousWindowStart.toISOString(), now.toISOString()],
  )

  const currentValues = initialAccumulator()
  const previousValues = initialAccumulator()
  const currentPoints: Record<TrendMetricKey, TrendPoint[]> = {
    hr: [],
    spo2: [],
    hrv: [],
  }

  for (const rawRow of result.values ?? []) {
    const row = rawRow as unknown as ShortTermRecordRow
    const timestamp = String(row.window_start)
    const pointTime = new Date(timestamp).getTime()
    const hr = Number(row.avg_hr)
    const spo2 = Number(row.avg_spo2)
    const hrv = Number(row.avg_hrv)

    if (pointTime >= currentWindowStart.getTime()) {
      currentPoints.hr.push({ timestamp, value: hr })
      currentPoints.spo2.push({ timestamp, value: spo2 })
      currentPoints.hrv.push({ timestamp, value: hrv })
      currentValues.hr.push(hr)
      currentValues.spo2.push(spo2)
      currentValues.hrv.push(hrv)
      continue
    }

    if (pointTime >= previousWindowStart.getTime() && pointTime <= previousWindowEnd.getTime()) {
      previousValues.hr.push(hr)
      previousValues.spo2.push(spo2)
      previousValues.hrv.push(hrv)
    }
  }

  const rangeLabel = '最近 7 天'
  const window: TrendWindow = {
    label: formatShortTermWindowLabel(currentWindowStart, now),
    startAt: currentWindowStart.toISOString(),
    endAt: now.toISOString(),
    previousStartAt: previousWindowStart.toISOString(),
    previousEndAt: previousWindowEnd.toISOString(),
  }

  return {
    mode: 'short_term',
    window,
    metrics: (Object.keys(METRIC_DEFINITIONS) as TrendMetricKey[]).map((key) =>
      buildMetricReport(
        key,
        rangeLabel,
        currentPoints[key],
        currentValues[key],
        previousValues[key],
      ),
    ),
  }
}

function mapLongTermMetric(
  key: TrendMetricKey,
  rangeLabel: string,
  response: LongTermTrendMetricApiResponse,
): TrendMetricReport {
  return {
    key,
    label: METRIC_DEFINITIONS[key].label,
    unit: METRIC_DEFINITIONS[key].unit,
    rangeLabel,
    points: response.points.map((point) => ({
      timestamp: point.timestamp,
      value: Number(point.value),
    })),
    summary: {
      average: response.summary.average,
      deltaFromPrevious: response.summary.delta_from_previous,
    },
  }
}

function mapLongTermAlertHint(response: LongTermTrendApiResponse['alert_hint']): TrendAlertHint {
  return {
    hasAlert: response.has_alert,
    count: response.count,
    latestAlertType: response.latest_alert_type,
    latestAlertTypeLabel: response.latest_alert_type_label,
    latestRiskScore: response.latest_risk_score,
    latestSeverityLabel: response.latest_severity_label,
    latestTriggerReason: response.latest_trigger_reason,
    latestWindowStart: response.latest_window_start,
    latestWindowEnd: response.latest_window_end,
  }
}

export async function fetchLongTermTrendReport(
  token: string,
  month: string,
): Promise<TrendReport> {
  let response: Response

  try {
    response = await fetch(`${getApiBaseUrl()}/trends/long-term?month=${encodeURIComponent(month)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new TrendReportServiceError('目前無法連線到伺服器，請稍後再試', 'network')
  }

  if (response.status === 401) {
    throw new TrendReportServiceError('登入狀態已失效', 'unauthorized', 401)
  }

  if (!response.ok) {
    throw new TrendReportServiceError(`取得長期趨勢報表失敗：${response.status}`, 'http', response.status)
  }

  const payload = (await response.json()) as LongTermTrendApiResponse
  const rangeLabel = payload.window.label

  return {
    mode: 'long_term',
    window: {
      month: payload.window.month,
      label: payload.window.label,
      startAt: payload.window.start_at,
      endAt: payload.window.end_at,
      previousStartAt: payload.window.previous_start_at,
      previousEndAt: payload.window.previous_end_at,
    },
    metrics: [
      mapLongTermMetric('hr', rangeLabel, payload.hr),
      mapLongTermMetric('spo2', rangeLabel, payload.spo2),
      mapLongTermMetric('hrv', rangeLabel, payload.hrv),
    ],
    alertHint: mapLongTermAlertHint(payload.alert_hint),
  }
}
