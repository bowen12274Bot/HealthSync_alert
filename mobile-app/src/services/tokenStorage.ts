import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { Capacitor } from '@capacitor/core'

const AUTH_TOKEN_KEY = 'healthsync.auth.token'
const AUTH_USER_KEY = 'healthsync.auth.user'

export interface PersistedAuthUser {
  id: number
  email: string
  status: string
}

export interface PersistedAuthSession {
  token: string
  user: PersistedAuthUser | null
}

function isNativeRuntime(): boolean {
  return Capacitor.isNativePlatform()
}

async function readStorageItem(key: string): Promise<string> {
  if (isNativeRuntime()) {
    return (await SecureStorage.getItem(key)) ?? ''
  }

  return localStorage.getItem(key) ?? ''
}

async function writeStorageItem(key: string, value: string): Promise<void> {
  if (isNativeRuntime()) {
    await SecureStorage.setItem(key, value)
    return
  }

  localStorage.setItem(key, value)
}

async function removeStorageItem(key: string): Promise<void> {
  if (isNativeRuntime()) {
    await SecureStorage.removeItem(key)
    return
  }

  localStorage.removeItem(key)
}

export async function readAuthToken(): Promise<string> {
  return readStorageItem(AUTH_TOKEN_KEY)
}

export async function writeAuthToken(token: string): Promise<void> {
  await writeStorageItem(AUTH_TOKEN_KEY, token)
}

export async function clearAuthToken(): Promise<void> {
  await removeStorageItem(AUTH_TOKEN_KEY)
}

export async function hasPersistedAuthToken(): Promise<boolean> {
  return (await readAuthToken()).length > 0
}

export async function readAuthUser(): Promise<PersistedAuthUser | null> {
  const rawValue = await readStorageItem(AUTH_USER_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as PersistedAuthUser
  } catch {
    return null
  }
}

export async function writeAuthUser(user: PersistedAuthUser): Promise<void> {
  await writeStorageItem(AUTH_USER_KEY, JSON.stringify(user))
}

export async function clearAuthUser(): Promise<void> {
  await removeStorageItem(AUTH_USER_KEY)
}

export async function readAuthSession(): Promise<PersistedAuthSession> {
  const [token, user] = await Promise.all([readAuthToken(), readAuthUser()])
  return { token, user }
}

export async function writeAuthSession(session: PersistedAuthSession): Promise<void> {
  const operations: Promise<void>[] = [writeAuthToken(session.token)]

  if (session.user) {
    operations.push(writeAuthUser(session.user))
  } else {
    operations.push(clearAuthUser())
  }

  await Promise.all(operations)
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([clearAuthToken(), clearAuthUser()])
}
