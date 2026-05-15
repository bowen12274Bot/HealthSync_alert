import { computed, onMounted, onUnmounted, ref } from 'vue'

import { getLatestHealthRecord } from '@/modules/health-simulation/storage/repository'

const REFRESH_INTERVAL_MS = 1500

export function useLatestHealthRecord() {
  const heartRate = ref<string>('--')
  const hrv = ref<string>('--')
  const spO2 = ref<string>('--')
  const hasRecord = ref(false)

  let intervalId: ReturnType<typeof setInterval> | null = null

  async function refresh(): Promise<void> {
    const latestRecord = await getLatestHealthRecord()

    if (!latestRecord) {
      hasRecord.value = false
      heartRate.value = '--'
      hrv.value = '--'
      spO2.value = '--'
      return
    }

    hasRecord.value = true
    heartRate.value = String(latestRecord.heartRate)
    hrv.value = String(latestRecord.hrv)
    spO2.value = Number.isInteger(latestRecord.spO2)
      ? String(latestRecord.spO2)
      : latestRecord.spO2.toFixed(1)
  }

  onMounted(() => {
    void refresh()
    intervalId = setInterval(() => {
      void refresh()
    }, REFRESH_INTERVAL_MS)
  })

  onUnmounted(() => {
    if (intervalId === null) {
      return
    }

    clearInterval(intervalId)
    intervalId = null
  })

  return {
    hasRecord: computed(() => hasRecord.value),
    heartRate: computed(() => heartRate.value),
    hrv: computed(() => hrv.value),
    spO2: computed(() => spO2.value),
  }
}
