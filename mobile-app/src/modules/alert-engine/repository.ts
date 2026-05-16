import { Capacitor } from '@capacitor/core'

import { getDatabaseConnection } from '@/db/sqlite'

import type { RealtimeHealthRecord } from './types'

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

export { DEFAULT_ANALYSIS_WINDOW_SIZE }
