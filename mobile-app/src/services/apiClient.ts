import type { HealthResponse } from '@/types/api'

const defaultBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'

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
