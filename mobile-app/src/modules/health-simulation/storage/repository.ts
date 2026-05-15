import { Capacitor } from '@capacitor/core'

import { getDatabaseConnection } from '@/db/sqlite'

import type { RawHealthRecord } from '../types'

export async function writeHealthRecord(record: RawHealthRecord): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const db = await getDatabaseConnection()
  await db.run(
    `INSERT INTO realtime_health_records
       (id, heart_rate, hrv, sp_o2, activity_level, recorded_at, sync_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.heartRate,
      record.hrv,
      record.spO2,
      record.activityLevel,
      record.recordedAt,
      record.syncStatus,
    ],
  )
}
