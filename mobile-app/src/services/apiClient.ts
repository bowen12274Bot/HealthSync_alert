import { Capacitor } from '@capacitor/core'

import type { HealthResponse } from '@/types/api'

function getDefaultBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

  if (configuredBaseUrl) {
    return configuredBaseUrl
  }

  if (Capacitor.getPlatform() === 'android') {
    return 'http://10.0.2.2:8000'
  }

  return 'http://127.0.0.1:8000'
}

const defaultBaseUrl = getDefaultBaseUrl()

export function getApiBaseUrl(): string {
  return defaultBaseUrl
}

export async function fetchServerHealth(): Promise<HealthResponse> {
  const response = await fetch(`${defaultBaseUrl}/health`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as HealthResponse
}
