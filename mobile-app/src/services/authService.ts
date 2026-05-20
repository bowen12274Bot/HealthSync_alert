import { getApiBaseUrl } from './apiClient'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: 'bearer'
}

export interface CurrentUser {
  id: number
  email: string
  status: string
}

export interface ActivityBaselineProfileResponse {
  activity_level: number
  target_hr: number
  target_hrv: number
  target_spo2: number
  updated_at: string
}

export class AuthServiceError extends Error {
  readonly code: 'network' | 'unauthorized' | 'not_found' | 'http'
  readonly status?: number

  constructor(message: string, code: AuthServiceError['code'], status?: number) {
    super(message)
    this.name = 'AuthServiceError'
    this.code = code
    this.status = status
  }
}

function createNetworkErrorMessage(): AuthServiceError {
  return new AuthServiceError(
    '目前無法連線到伺服器，請確認網路狀態後再試一次',
    'network',
  )
}

async function performJsonRequest(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch {
    throw createNetworkErrorMessage()
  }
}

export async function loginWithEmailPassword(payload: LoginRequest): Promise<LoginResponse> {
  const response = await performJsonRequest(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 401) {
    throw new AuthServiceError('帳號或密碼錯誤', 'unauthorized', 401)
  }

  if (!response.ok) {
    throw new AuthServiceError(`登入失敗：${response.status}`, 'http', response.status)
  }

  return (await response.json()) as LoginResponse
}

export async function fetchCurrentUser(token: string): Promise<CurrentUser> {
  const response = await performJsonRequest(`${getApiBaseUrl()}/auth/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 401) {
    throw new AuthServiceError('登入狀態已失效', 'unauthorized', 401)
  }

  if (!response.ok) {
    throw new AuthServiceError(`驗證登入狀態失敗：${response.status}`, 'http', response.status)
  }

  return (await response.json()) as CurrentUser
}

export async function fetchCurrentUserActivityBaselines(
  token: string,
): Promise<ActivityBaselineProfileResponse[]> {
  const response = await performJsonRequest(`${getApiBaseUrl()}/auth/me/baseline`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 401) {
    throw new AuthServiceError('登入狀態已失效', 'unauthorized', 401)
  }

  if (response.status === 404) {
    throw new AuthServiceError('尚未取得活動基準資料', 'not_found', 404)
  }

  if (!response.ok) {
    throw new AuthServiceError(
      `取得活動基準資料失敗：${response.status}`,
      'http',
      response.status,
    )
  }

  return (await response.json()) as ActivityBaselineProfileResponse[]
}
