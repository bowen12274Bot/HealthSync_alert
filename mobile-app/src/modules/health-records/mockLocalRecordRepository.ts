import type { LocalRecord, LocalRecordRepository } from './types'

const STORAGE_KEY = 'healthsync-local-records'

function readStoredRecords(): LocalRecord[] {
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as LocalRecord[]
  } catch {
    return []
  }
}

function writeStoredRecords(records: LocalRecord[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export class MockLocalRecordRepository implements LocalRecordRepository {
  async init(): Promise<void> {
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      writeStoredRecords([])
    }
  }

  async save(record: LocalRecord): Promise<void> {
    const records = readStoredRecords()
    records.unshift(record)
    writeStoredRecords(records)
  }

  async list(): Promise<LocalRecord[]> {
    return readStoredRecords()
  }

  async clear(): Promise<void> {
    writeStoredRecords([])
  }
}
