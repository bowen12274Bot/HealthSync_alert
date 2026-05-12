import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  fetchCurrentUser,
  loginWithEmailPassword,
  logoutSession,
  type CurrentUser,
} from '@/services/authService'
import {
  clearAuthToken,
  readAuthToken,
  writeAuthToken,
} from '@/services/tokenStorage'

export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  const currentUser = ref<CurrentUser | null>(null)
  const isReady = ref(false)
  const isAuthenticated = computed(() => token.value.length > 0 && currentUser.value !== null)

  async function clearSession() {
    token.value = ''
    currentUser.value = null
    await clearAuthToken()
  }

  async function initialize() {
    if (isReady.value) {
      return
    }

    const storedToken = await readAuthToken()

    if (!storedToken) {
      isReady.value = true
      return
    }

    try {
      currentUser.value = await fetchCurrentUser(storedToken)
      token.value = storedToken
    } catch {
      await clearSession()
    } finally {
      isReady.value = true
    }
  }

  async function login(email: string, password: string) {
    const result = await loginWithEmailPassword({ email, password })
    currentUser.value = await fetchCurrentUser(result.access_token)
    token.value = result.access_token
    await writeAuthToken(result.access_token)
    isReady.value = true
  }

  async function logout() {
    const currentToken = token.value

    if (currentToken) {
      try {
        await logoutSession(currentToken)
      } catch {
        // Local logout still wins if the network or server logout fails.
      }
    }

    await clearSession()
    isReady.value = true
  }

  return { token, currentUser, isReady, isAuthenticated, initialize, login, logout }
})
