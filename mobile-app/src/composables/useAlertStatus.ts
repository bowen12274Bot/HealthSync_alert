import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  getActiveRealtimeAlert,
  getLatestAlertStatus,
  getLatestRealtimeAlert,
} from '@/modules/alert-engine/repository'
import type { AlertLifecycleStatus, AlertType } from '@/modules/alert-engine/types'

interface AlertStatusData {
  hasActiveAlert: boolean
  alertType: AlertType | null
  riskScore: number
  severity: 0 | 1 | 2 | 3
  status: AlertLifecycleStatus | null
  triggerReasons: string[]
  detectionStartTime: string | null
  firstOccurredAt: string | null
  lastResolvedTime: string | null
}

const POLLING_INTERVAL_MS = 5000

const defaultAlertStatusData = (): AlertStatusData => ({
  hasActiveAlert: false,
  alertType: null,
  riskScore: 0,
  severity: 0,
  status: null,
  triggerReasons: [],
  detectionStartTime: null,
  firstOccurredAt: null,
  lastResolvedTime: null,
})

const alertData = ref<AlertStatusData>(defaultAlertStatusData())
let intervalId: ReturnType<typeof setInterval> | null = null
let activeConsumers = 0
let inFlightFetch: Promise<void> | null = null

function getAlertSeverityLevel(riskScore: number): 0 | 1 | 2 | 3 {
  if (riskScore <= 2) return 0
  if (riskScore <= 4) return 1
  if (riskScore <= 6) return 2
  return 3
}

async function fetchAlertStatus(): Promise<void> {
  try {
    const activeAlert = await getActiveRealtimeAlert()

    if (activeAlert === null) {
      const latestAlert = await getLatestRealtimeAlert()
      const lastResolvedTime = latestAlert?.detectionEndTime ?? null

      alertData.value = {
        hasActiveAlert: false,
        alertType: null,
        riskScore: 0,
        severity: 0,
        status: null,
        triggerReasons: [],
        detectionStartTime: null,
        firstOccurredAt: null,
        lastResolvedTime,
      }
      return
    }

    const latestStatus = await getLatestAlertStatus(activeAlert.alertId)
    if (latestStatus === null) {
      return
    }

    const triggerReasons = latestStatus.statusDescription
      .split(' / ')
      .filter((reason) => reason.trim().length > 0)

    alertData.value = {
      hasActiveAlert: true,
      alertType: activeAlert.alertType as AlertType,
      riskScore: latestStatus.riskScore,
      severity: getAlertSeverityLevel(latestStatus.riskScore),
      status: latestStatus.status,
      triggerReasons,
      detectionStartTime: activeAlert.detectionStartTime,
      firstOccurredAt: activeAlert.firstOccurredAt,
      lastResolvedTime: null,
    }
  } catch (error) {
    console.error('Failed to fetch alert status:', error)
    alertData.value = defaultAlertStatusData()
  }
}

export async function refreshAlertStatus(): Promise<void> {
  if (inFlightFetch !== null) {
    await inFlightFetch
    return
  }

  inFlightFetch = fetchAlertStatus().finally(() => {
    inFlightFetch = null
  })
  await inFlightFetch
}

function ensurePollingStarted(): void {
  if (intervalId !== null) {
    return
  }

  void refreshAlertStatus()
  intervalId = setInterval(() => {
    void refreshAlertStatus()
  }, POLLING_INTERVAL_MS)
}

function stopPollingIfIdle(): void {
  if (activeConsumers > 0 || intervalId === null) {
    return
  }

  clearInterval(intervalId)
  intervalId = null
}

export function useAlertStatus() {
  const hasActiveAlert = computed(() => alertData.value.hasActiveAlert)
  const isHealthy = computed(() => !alertData.value.hasActiveAlert)

  const alertLevel = computed(() => {
    if (!alertData.value.hasActiveAlert) return 'healthy'

    const score = alertData.value.riskScore
    if (score <= 4) return 'warning'
    if (score <= 6) return 'critical'
    return 'severe'
  })

  const alertTitle = computed(() => {
    switch (alertLevel.value) {
      case 'healthy':
        return '健康狀態良好'
      case 'warning':
        return '⚠️ 輕度警告'
      case 'critical':
        return '🔶 中度警告'
      case 'severe':
        return '🔴 重度警告'
      default:
        return '健康狀態良好'
    }
  })

  const alertSubtitle = computed(() => {
    if (!alertData.value.hasActiveAlert) {
      return '目前所有指標在正常範圍內'
    }
    return alertData.value.triggerReasons.join(' / ') || '檢測到異常指標'
  })

  const alertDuration = computed(() => {
    if (alertData.value.hasActiveAlert && alertData.value.detectionStartTime) {
      const start = new Date(alertData.value.detectionStartTime).getTime()
      const now = Date.now()
      const diffMs = now - start
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 60) {
        return { label: '警告持續', value: `${diffMins} 分鐘` }
      }

      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) {
        return { label: '警告持續', value: `${diffHours} 小時` }
      }

      const diffDays = Math.floor(diffHours / 24)
      return { label: '警告持續', value: `${diffDays} 天` }
    }

    if (alertData.value.lastResolvedTime) {
      const resolvedTime = new Date(alertData.value.lastResolvedTime).getTime()
      const now = Date.now()
      const diffMs = now - resolvedTime
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays >= 7) {
        return { label: '持續健康', value: '7 天' }
      }

      return { label: '持續健康', value: `${diffDays} 天` }
    }

    return { label: '持續健康', value: '7 天' }
  })

  onMounted(() => {
    activeConsumers += 1
    ensurePollingStarted()
  })

  onUnmounted(() => {
    activeConsumers = Math.max(0, activeConsumers - 1)
    stopPollingIfIdle()
  })

  return {
    alertData,
    hasActiveAlert,
    isHealthy,
    alertLevel,
    alertTitle,
    alertSubtitle,
    alertDuration,
    refreshAlertStatus,
  }
}
