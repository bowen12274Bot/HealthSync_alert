import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { Capacitor } from '@capacitor/core'

import {
  simulationRuntime,
  type ActivityBaselineProfile as SimulationActivityBaselineProfile,
} from '@/modules/health-simulation'
import {
  listActivityBaselineProfiles,
  listCachedActivityBaselineProfiles,
  replaceCachedActivityBaselineProfiles,
} from '@/modules/alert-engine'
import {
  AuthServiceError,
  fetchCurrentUserActivityBaselines,
  fetchCurrentUser,
  loginWithEmailPassword,
  type CurrentUser,
} from '@/services/authService'
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} from '@/services/tokenStorage'

type LoginPhase = 'idle' | 'authenticating' | 'baseline_initializing' | 'baseline_retrying'

const BASELINE_RETRY_DELAY_MS = 5000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function requiresBaselineInitialization(): boolean {
  return Capacitor.isNativePlatform()
}

function initializeWebSimulationBaselines(): void {
  simulationRuntime.setActivityBaselineProfiles([...listActivityBaselineProfiles()])
}

function isRetriableBaselineError(error: unknown): boolean {
  if (!(error instanceof AuthServiceError)) {
    return true
  }

  if (error.code === 'network') {
    return true
  }

  return error.code === 'http' && (error.status ?? 0) >= 500
}

function mapBaselineProfilesForMobileStore(
  profiles: readonly {
    activity_level: number
    target_hr: number
    target_hrv: number
    target_spo2: number
  }[],
): SimulationActivityBaselineProfile[] {
  return profiles.map((profile) => ({
    activityLevel: profile.activity_level as 0 | 1 | 2 | 3,
    targetHr: profile.target_hr,
    targetHrv: profile.target_hrv,
    targetSpO2: profile.target_spo2,
  }))
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  const currentUser = ref<CurrentUser | null>(null)
  const isReady = ref(false)
  const loginPhase = ref<LoginPhase>('idle')
  const isAuthenticated = computed(() => token.value.length > 0)
  const isLoginPending = computed(() => loginPhase.value !== 'idle')
  const loginStatusMessage = computed(() => {
    if (loginPhase.value === 'authenticating') {
      return '登入中...'
    }

    if (loginPhase.value === 'baseline_initializing') {
      return '正在初始化個人基準資料...'
    }

    if (loginPhase.value === 'baseline_retrying') {
      return '個人基準資料初始化失敗，系統將自動重試'
    }

    return ''
  })

  function applySession(nextToken: string, nextUser: CurrentUser | null) {
    token.value = nextToken
    currentUser.value = nextUser
  }

  function resetLoginPhase() {
    loginPhase.value = 'idle'
  }

  async function clearSession() {
    applySession('', null)
    if (requiresBaselineInitialization()) {
      simulationRuntime.setActivityBaselineProfiles([])
    }
    resetLoginPhase()
    await clearAuthSession()
  }

  async function initialize() {
    if (isReady.value) {
      return
    }

    const { token: storedToken, user: storedUser } = await readAuthSession()

    if (!storedToken) {
      if (!requiresBaselineInitialization()) {
        initializeWebSimulationBaselines()
      }
      isReady.value = true
      return
    }

    applySession(storedToken, storedUser)
    if (requiresBaselineInitialization()) {
      const cachedProfiles = await listCachedActivityBaselineProfiles()
      if (cachedProfiles.length > 0) {
        simulationRuntime.setActivityBaselineProfiles(cachedProfiles)
      } else {
        try {
          await initializeActivityBaselines(storedToken)
        } catch {
          await clearSession()
        }
      }
    } else {
      initializeWebSimulationBaselines()
    }
    resetLoginPhase()
    isReady.value = true
  }

  async function initializeActivityBaselines(nextToken: string) {
    loginPhase.value = 'baseline_initializing'

    while (true) {
      try {
        const profiles = await fetchCurrentUserActivityBaselines(nextToken)
        const mappedProfiles = mapBaselineProfilesForMobileStore(profiles)
        await replaceCachedActivityBaselineProfiles(mappedProfiles)
        simulationRuntime.setActivityBaselineProfiles(mappedProfiles)
        return
      } catch (error) {
        if (!isRetriableBaselineError(error)) {
          throw error
        }

        loginPhase.value = 'baseline_retrying'
        await delay(BASELINE_RETRY_DELAY_MS)
        loginPhase.value = 'baseline_initializing'
      }
    }
  }

  async function login(email: string, password: string) {
    loginPhase.value = 'authenticating'

    const result = await loginWithEmailPassword({ email, password })
    const user = await fetchCurrentUser(result.access_token)

    if (requiresBaselineInitialization()) {
      await initializeActivityBaselines(result.access_token)
    } else {
      initializeWebSimulationBaselines()
    }

    applySession(result.access_token, user)
    await writeAuthSession({ token: result.access_token, user })
    isReady.value = true
    resetLoginPhase()
  }

  async function logout() {
    await clearSession()
    isReady.value = true
  }

  return {
    token,
    currentUser,
    isReady,
    isAuthenticated,
    isLoginPending,
    loginPhase,
    loginStatusMessage,
    resetLoginPhase,
    initialize,
    login,
    logout,
  }
})
