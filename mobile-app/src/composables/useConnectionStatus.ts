import { Capacitor } from '@capacitor/core'
import { Network, type ConnectionStatus } from '@capacitor/network'
import { computed, onMounted, ref } from 'vue'

import { fetchServerHealth } from '@/services/apiClient'

type ConnectionState = 'online' | 'offline'

const RETRY_INTERVAL_MS = 5000

const status = ref<ConnectionState>('offline')
const deviceOnline = ref(false)
const isRetrying = ref(false)
const isPinging = ref(false)
const retryCountdownSeconds = ref(0)

let hasInitialized = false
let retryTimerId: ReturnType<typeof setTimeout> | null = null
let retryCountdownTimerId: ReturnType<typeof setInterval> | null = null

function isNativeRuntime(): boolean {
  return Capacitor.isNativePlatform()
}

function readNavigatorOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') {
    return true
  }

  return navigator.onLine
}

function hasUsableNetwork(connectionStatus: ConnectionStatus): boolean {
  return connectionStatus.connected || connectionStatus.connectionType !== 'none'
}

function updateStatus(isServerReachable: boolean) {
  status.value = deviceOnline.value && isServerReachable ? 'online' : 'offline'
}

function stopRetryTimer() {
  if (retryTimerId !== null) {
    clearTimeout(retryTimerId)
    retryTimerId = null
  }

  isRetrying.value = false
  isPinging.value = false
  stopRetryCountdownTimer()
  retryCountdownSeconds.value = 0
}

function stopRetryCountdownTimer() {
  if (retryCountdownTimerId === null) {
    return
  }

  clearInterval(retryCountdownTimerId)
  retryCountdownTimerId = null
}

function startRetryCountdown() {
  stopRetryCountdownTimer()
  retryCountdownSeconds.value = RETRY_INTERVAL_MS / 1000

  retryCountdownTimerId = setInterval(() => {
    if (retryCountdownSeconds.value <= 1) {
      return
    }

    retryCountdownSeconds.value -= 1
  }, 1000)
}

async function pingServer(): Promise<boolean> {
  isPinging.value = true

  try {
    await fetchServerHealth()
    updateStatus(true)
    stopRetryTimer()
    return true
  } catch {
    updateStatus(false)
    return false
  } finally {
    isPinging.value = false
  }
}

function scheduleRetryAttempt() {
  if (!deviceOnline.value) {
    stopRetryTimer()
    updateStatus(false)
    return
  }

  isRetrying.value = true
  startRetryCountdown()
  retryTimerId = setTimeout(async () => {
    retryTimerId = null
    stopRetryCountdownTimer()

    if (!deviceOnline.value) {
      stopRetryTimer()
      updateStatus(false)
      return
    }

    const isReachable = await pingServer()

    if (!isReachable) {
      scheduleRetryAttempt()
    }
  }, RETRY_INTERVAL_MS)
}

function ensureRetryTimer() {
  if (!deviceOnline.value || retryTimerId !== null) {
    return
  }

  scheduleRetryAttempt()
}

async function refreshConnectionStatus() {
  if (!deviceOnline.value) {
    stopRetryTimer()
    updateStatus(false)
    return
  }

  const isReachable = await pingServer()

  if (!isReachable) {
    ensureRetryTimer()
  }
}

async function handleDeviceNetworkChange(nextDeviceOnline: boolean) {
  const wasDeviceOnline = deviceOnline.value
  deviceOnline.value = nextDeviceOnline

  if (!nextDeviceOnline) {
    stopRetryTimer()
    updateStatus(false)
    return
  }

  if (wasDeviceOnline && status.value === 'online') {
    return
  }

  await refreshConnectionStatus()
}

function registerWebNetworkListeners() {
  if (typeof window === 'undefined') {
    return
  }

  window.addEventListener('online', () => {
    void handleDeviceNetworkChange(true)
  })

  window.addEventListener('offline', () => {
    void handleDeviceNetworkChange(false)
  })
}

async function registerNativeNetworkListeners() {
  await Network.addListener('networkStatusChange', (connectionStatus: ConnectionStatus) => {
    void handleDeviceNetworkChange(hasUsableNetwork(connectionStatus))
  })
}

async function initializeConnectionStatus() {
  if (hasInitialized) {
    return
  }

  hasInitialized = true

  if (isNativeRuntime()) {
    const connectionStatus = await Network.getStatus()
    deviceOnline.value = hasUsableNetwork(connectionStatus)
    await registerNativeNetworkListeners()
  } else {
    deviceOnline.value = readNavigatorOnlineStatus()
    registerWebNetworkListeners()
  }

  await refreshConnectionStatus()
}

export function markConnectionAvailable() {
  if (!deviceOnline.value) {
    return
  }

  updateStatus(true)
  stopRetryTimer()
}

export function markConnectionUnavailable() {
  updateStatus(false)

  if (deviceOnline.value) {
    ensureRetryTimer()
  }
}

export function useConnectionStatus() {
  onMounted(() => {
    void initializeConnectionStatus()
  })

  return {
    status: computed(() => status.value),
    isOnline: computed(() => status.value === 'online'),
    isRetrying: computed(() => isRetrying.value),
    isPinging: computed(() => isPinging.value),
    retryCountdownSeconds: computed(() => retryCountdownSeconds.value),
  }
}
