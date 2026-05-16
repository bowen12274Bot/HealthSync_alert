import { Capacitor } from '@capacitor/core'

import { MockLocalRecordRepository } from './mockLocalRecordRepository'
import { SqliteLocalRecordRepository } from './sqliteLocalRecordRepository'
import type { LocalRecordRepository } from './types'

export function createLocalRecordRepository(): LocalRecordRepository {
  if (Capacitor.isNativePlatform()) {
    return new SqliteLocalRecordRepository()
  }

  return new MockLocalRecordRepository()
}

export function getRuntimeStorageLabel(): string {
  return Capacitor.isNativePlatform() ? 'sqlite-native' : 'web-mock-localstorage'
}
