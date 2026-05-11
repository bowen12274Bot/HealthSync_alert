export interface LocalRecord {
  id: string
  type: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface LocalRecordRepository {
  init(): Promise<void>
  save(record: LocalRecord): Promise<void>
  list(): Promise<LocalRecord[]>
  clear(): Promise<void>
}
