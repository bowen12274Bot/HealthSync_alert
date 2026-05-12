import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { Capacitor } from '@capacitor/core'

const AUTH_TOKEN_KEY = 'healthsync.auth.token'

function isNativeRuntime(): boolean {
  return Capacitor.isNativePlatform()
}

export async function readAuthToken(): Promise<string> {
  if (isNativeRuntime()) {
    return (await SecureStorage.getItem(AUTH_TOKEN_KEY)) ?? ''
  }

  return localStorage.getItem(AUTH_TOKEN_KEY) ?? ''
}

export async function writeAuthToken(token: string): Promise<void> {
  if (isNativeRuntime()) {
    await SecureStorage.setItem(AUTH_TOKEN_KEY, token)
    return
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export async function clearAuthToken(): Promise<void> {
  if (isNativeRuntime()) {
    await SecureStorage.removeItem(AUTH_TOKEN_KEY)
    return
  }

  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export async function hasPersistedAuthToken(): Promise<boolean> {
  return (await readAuthToken()).length > 0
}
