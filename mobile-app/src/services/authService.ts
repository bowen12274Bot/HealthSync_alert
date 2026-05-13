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

function createNetworkErrorMessage(): Error {
  return new Error('目前無法連線到伺服器，請確認網路狀態後再試一次')
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
    throw new Error('帳號或密碼錯誤')
  }

  if (!response.ok) {
    throw new Error(`登入失敗：${response.status}`)
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
    throw new Error('登入狀態已失效')
  }

  if (!response.ok) {
    throw new Error(`驗證登入狀態失敗：${response.status}`)
  }

  return (await response.json()) as CurrentUser
}
