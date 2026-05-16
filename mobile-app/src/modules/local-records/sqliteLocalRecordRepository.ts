import { getDatabaseConnection } from '@/db/sqlite'

import type { LocalRecord, LocalRecordRepository } from './types'

export class SqliteLocalRecordRepository implements LocalRecordRepository {
  async init(): Promise<void> {
    await getDatabaseConnection()
  }

  async save(record: LocalRecord): Promise<void> {
    const db = await getDatabaseConnection()

    await db.run(
      `
        INSERT OR REPLACE INTO local_records (id, type, payload, created_at)
        VALUES (?, ?, ?, ?)
      `,
      [record.id, record.type, JSON.stringify(record.payload), record.createdAt],
    )
  }

  async list(): Promise<LocalRecord[]> {
    const db = await getDatabaseConnection()
    const result = await db.query(
      `
        SELECT id, type, payload, created_at
        FROM local_records
        ORDER BY created_at DESC
      `,
    )

    const rows = result.values ?? []

    return rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      payload:
        typeof row.payload === 'string' && row.payload.length > 0
          ? (JSON.parse(row.payload) as Record<string, unknown>)
          : {},
      createdAt: String(row.created_at),
    }))
  }

  async clear(): Promise<void> {
    const db = await getDatabaseConnection()
    await db.run('DELETE FROM local_records')
  }
}
