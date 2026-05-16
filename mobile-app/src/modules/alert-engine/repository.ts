import { Capacitor } from '@capacitor/core'

import { getDatabaseConnection } from '@/db/sqlite'

import type {
  AlertStatusRecord,
  AlertType,
  RealtimeAlertRecord,
  RealtimeHealthRecord,
} from './types'

const DEFAULT_ANALYSIS_WINDOW_SIZE = 12

function mapRowToRealtimeHealthRecord(row: Record<string, unknown>): RealtimeHealthRecord {
  return {
    id: String(row.id),
    heartRate: Number(row.heart_rate),
    hrv: Number(row.hrv),
    spO2: Number(row.sp_o2),
    activityLevel: Number(row.activity_level) as RealtimeHealthRecord['activityLevel'],
    recordedAt: String(row.recorded_at),
  }
}

export async function getRecentRealtimeHealthRecords(
  limit: number = DEFAULT_ANALYSIS_WINDOW_SIZE,
): Promise<RealtimeHealthRecord[]> {
  if (!Capacitor.isNativePlatform()) {
    return []
  }

  const db = await getDatabaseConnection()
  const result = await db.query(
    `SELECT id, heart_rate, hrv, sp_o2, activity_level, recorded_at
       FROM realtime_health_records
      ORDER BY recorded_at DESC
      LIMIT ?`,
    [limit],
  )

  const records = (result.values ?? []).map((row) =>
    mapRowToRealtimeHealthRecord(row as Record<string, unknown>),
  )

  return records.reverse()
}

function mapRowToRealtimeAlertRecord(row: Record<string, unknown>): RealtimeAlertRecord {
  return {
    alertId: String(row.alert_id),
    alertType: String(row.alert_type),
    initialRiskScore: Number(row.initial_risk_score),
    triggerReason: String(row.trigger_reason),
    detectionStartTime: String(row.detection_start_time),
    detectionEndTime: row.detection_end_time === null ? null : String(row.detection_end_time),
    firstOccurredAt: String(row.first_occurred_at),
    syncStatus: String(row.sync_status) as RealtimeAlertRecord['syncStatus'],
  }
}

function mapRowToAlertStatusRecord(row: Record<string, unknown>): AlertStatusRecord {
  return {
    statusId: String(row.status_id),
    alertId: String(row.alert_id),
    status: String(row.status) as AlertStatusRecord['status'],
    riskScore: Number(row.risk_score),
    statusTime: String(row.status_time),
    statusDescription: String(row.status_description),
  }
}

export async function createRealtimeAlert(record: RealtimeAlertRecord): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const db = await getDatabaseConnection()
  await db.run(
    `INSERT INTO realtime_alert
       (alert_id, alert_type, initial_risk_score, trigger_reason, detection_start_time,
        detection_end_time, first_occurred_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.alertId,
      record.alertType,
      record.initialRiskScore,
      record.triggerReason,
      record.detectionStartTime,
      record.detectionEndTime,
      record.firstOccurredAt,
      record.syncStatus,
    ],
  )
}

export async function appendAlertStatus(record: AlertStatusRecord): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const db = await getDatabaseConnection()
  await db.run(
    `INSERT INTO alert_status
       (status_id, alert_id, status, risk_score, status_time, status_description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      record.statusId,
      record.alertId,
      record.status,
      record.riskScore,
      record.statusTime,
      record.statusDescription,
    ],
  )
}

export async function getLatestRealtimeAlert(): Promise<RealtimeAlertRecord | null> {
  if (!Capacitor.isNativePlatform()) {
    return null
  }

  const db = await getDatabaseConnection()
  const result = await db.query(
    `SELECT alert_id, alert_type, initial_risk_score, trigger_reason, detection_start_time,
            detection_end_time, first_occurred_at, sync_status
       FROM realtime_alert
      ORDER BY first_occurred_at DESC
      LIMIT 1`,
  )

  const row = result.values?.[0]
  if (!row) {
    return null
  }

  return mapRowToRealtimeAlertRecord(row as Record<string, unknown>)
}

export async function getActiveRealtimeAlert(): Promise<RealtimeAlertRecord | null> {
  const latestAlert = await getLatestRealtimeAlert()

  if (latestAlert === null) {
    return null
  }

  const latestStatus = await getLatestAlertStatus(latestAlert.alertId)

  if (latestStatus === null || latestStatus.status === '已解除') {
    return null
  }

  return latestAlert
}

export async function getLatestAlertStatus(alertId: string): Promise<AlertStatusRecord | null> {
  if (!Capacitor.isNativePlatform()) {
    return null
  }

  const db = await getDatabaseConnection()
  const result = await db.query(
    `SELECT status_id, alert_id, status, risk_score, status_time, status_description
       FROM alert_status
      WHERE alert_id = ?
      ORDER BY status_time DESC
      LIMIT 1`,
    [alertId],
  )

  const row = result.values?.[0]
  if (!row) {
    return null
  }

  return mapRowToAlertStatusRecord(row as Record<string, unknown>)
}

export async function getRecentAlertStatuses(
  alertId: string,
  limit: number = 2,
): Promise<AlertStatusRecord[]> {
  if (!Capacitor.isNativePlatform()) {
    return []
  }

  const db = await getDatabaseConnection()
  const result = await db.query(
    `SELECT status_id, alert_id, status, risk_score, status_time, status_description
       FROM alert_status
      WHERE alert_id = ?
      ORDER BY status_time DESC
      LIMIT ?`,
    [alertId, limit],
  )

  const statuses = (result.values ?? []).map((row) =>
    mapRowToAlertStatusRecord(row as Record<string, unknown>),
  )

  return statuses.reverse()
}

export async function updateRealtimeAlertType(
  alertId: string,
  alertType: AlertType,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const db = await getDatabaseConnection()
  await db.run(
    `UPDATE realtime_alert
        SET alert_type = ?
      WHERE alert_id = ?`,
    [alertType, alertId],
  )
}

export async function closeRealtimeAlert(
  alertId: string,
  detectionEndTime: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const db = await getDatabaseConnection()
  await db.run(
    `UPDATE realtime_alert
        SET detection_end_time = ?
      WHERE alert_id = ?`,
    [detectionEndTime, alertId],
  )
}

export { DEFAULT_ANALYSIS_WINDOW_SIZE }
