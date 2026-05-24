import { Capacitor } from '@capacitor/core'

import type { HealthResponse } from '@/types/api'

const HEALTH_CHECK_TIMEOUT_MS = 3000

function getTrimmedEnvValue(value: string | undefined): string {
  return value?.trim() ?? ''
}

function isLikelyAndroidEmulator(): boolean {
  const userAgent = navigator.userAgent.toLowerCase()

  return (
    userAgent.includes('emulator')
    || userAgent.includes('sdk_gphone')
    || userAgent.includes('android sdk built for x86')
  )
}

function getDefaultBaseUrl(): string {
  const configuredBaseUrl = getTrimmedEnvValue(import.meta.env.VITE_API_BASE_URL)

  if (configuredBaseUrl) {
    return configuredBaseUrl
  }

  const platform = Capacitor.getPlatform()

  if (platform === 'android') {
    const androidBaseUrl = getTrimmedEnvValue(import.meta.env.VITE_API_BASE_URL_ANDROID)
    const androidDeviceBaseUrl = getTrimmedEnvValue(import.meta.env.VITE_API_BASE_URL_ANDROID_DEVICE)
    const androidEmulatorBaseUrl = getTrimmedEnvValue(import.meta.env.VITE_API_BASE_URL_ANDROID_EMULATOR)

    if (isLikelyAndroidEmulator()) {
      if (androidEmulatorBaseUrl) {
        return androidEmulatorBaseUrl
      }
    } else if (androidDeviceBaseUrl) {
      return androidDeviceBaseUrl
    }

    if (androidBaseUrl) {
      return androidBaseUrl
    }

    return 'http://10.0.2.2:8000'
  }

  return 'http://127.0.0.1:8000'
}

const defaultBaseUrl = getDefaultBaseUrl()

export function getApiBaseUrl(): string {
  return defaultBaseUrl
}

export async function fetchServerHealth(): Promise<HealthResponse> {
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => {
    abortController.abort()
  }, HEALTH_CHECK_TIMEOUT_MS)

  let response: Response

  try {
    response = await fetch(`${defaultBaseUrl}/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: abortController.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as HealthResponse
}
