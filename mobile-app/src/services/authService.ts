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

export async function loginWithEmailPassword(payload: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 401) {
    throw new Error('帳號或密碼錯誤')
  }

  if (!response.ok) {
    throw new Error(`登入失敗：${response.status}`)
  }

  return (await response.json()) as LoginResponse
}

export async function fetchCurrentUser(token: string): Promise<CurrentUser> {
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 401) {
    throw new Error('登入狀態已失效')
  }

  if (!response.ok) {
    throw new Error(`驗證登入狀態失敗：${response.status}`)
  }

  return (await response.json()) as CurrentUser
}

export async function logoutSession(token: string): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok && response.status !== 401) {
    throw new Error(`登出失敗：${response.status}`)
  }
}
