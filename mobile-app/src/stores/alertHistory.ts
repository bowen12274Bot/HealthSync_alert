import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  fetchAlertHistoryDetail,
  fetchAlertHistoryRecords,
} from '@/services/alertHistoryService'
import type { AlertHistoryDetail, AlertHistoryRecord } from '@/types/alertHistory'

const CACHE_TTL_MS = 2 * 60 * 1000

export const useAlertHistoryStore = defineStore('alert-history', () => {
  const records = ref<AlertHistoryRecord[]>([])
  const detailMap = ref<Record<string, AlertHistoryDetail>>({})
  const lastFetchedAt = ref<number | null>(null)
  const lastLimit = ref<number | null>(null)

  const hasFreshListCache = computed(() => {
    if (lastFetchedAt.value === null) {
      return false
    }
    return Date.now() - lastFetchedAt.value < CACHE_TTL_MS
  })

  function clearCache() {
    records.value = []
    detailMap.value = {}
    lastFetchedAt.value = null
    lastLimit.value = null
  }

  async function ensureRecords(token: string, limit: number, force = false): Promise<AlertHistoryRecord[]> {
    const canUseCache =
      !force &&
      hasFreshListCache.value &&
      lastLimit.value === limit &&
      records.value.length > 0

    if (canUseCache) {
      return records.value
    }

    const nextRecords = await fetchAlertHistoryRecords(token, limit)
    records.value = nextRecords
    lastFetchedAt.value = Date.now()
    lastLimit.value = limit
    return nextRecords
  }

  async function ensureDetail(
    token: string,
    recordId: string,
    force = false,
  ): Promise<AlertHistoryDetail> {
    const cachedDetail = detailMap.value[recordId]
    if (!force && cachedDetail !== undefined) {
      return cachedDetail
    }

    const nextDetail = await fetchAlertHistoryDetail(token, recordId)
    detailMap.value = {
      ...detailMap.value,
      [recordId]: nextDetail,
    }
    return nextDetail
  }

  function getDetail(recordId: string): AlertHistoryDetail | null {
    return detailMap.value[recordId] ?? null
  }

  return {
    records,
    detailMap,
    lastFetchedAt,
    lastLimit,
    clearCache,
    ensureRecords,
    ensureDetail,
    getDetail,
  }
})
