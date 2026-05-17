import { Capacitor } from '@capacitor/core'

import { getDatabaseConnection } from '@/db/sqlite'

import type { RawHealthRecord } from '../types'

const WEB_RECORDS_STORAGE_KEY = 'healthsync.web.realtimeHealthRecords'
const WEB_RECORD_LIMIT = 300

function readWebRecords(): RawHealthRecord[] {
  const raw = window.localStorage.getItem(WEB_RECORDS_STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RawHealthRecord[]) : []
  } catch {
    return []
  }
}

function writeWebRecord(record: RawHealthRecord): void {
  const records = [...readWebRecords(), record].slice(-WEB_RECORD_LIMIT)
  window.localStorage.setItem(WEB_RECORDS_STORAGE_KEY, JSON.stringify(records))
}

export async function writeHealthRecord(record: RawHealthRecord): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    writeWebRecord(record)
    return
  }

  const db = await getDatabaseConnection()
  await db.run(
    `INSERT INTO realtime_health_records
       (id, heart_rate, hrv, sp_o2, activity_level, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.heartRate,
      record.hrv,
      record.spO2,
      record.activityLevel,
      record.recordedAt,
    ],
  )
}

export async function getLatestHealthRecord(): Promise<RawHealthRecord | null> {
  if (!Capacitor.isNativePlatform()) {
    return readWebRecords().at(-1) ?? null
  }

  const db = await getDatabaseConnection()
  const result = await db.query(
    `SELECT id, heart_rate, hrv, sp_o2, activity_level, recorded_at
       FROM realtime_health_records
      ORDER BY recorded_at DESC
      LIMIT 1`,
  )

  const row = result.values?.[0]
  if (!row) {
    return null
  }

  return {
    id: String(row.id),
    heartRate: Number(row.heart_rate),
    hrv: Number(row.hrv),
    spO2: Number(row.sp_o2),
    activityLevel: Number(row.activity_level) as RawHealthRecord['activityLevel'],
    recordedAt: String(row.recorded_at),
  }
}
