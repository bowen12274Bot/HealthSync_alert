import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  fetchCurrentUser,
  loginWithEmailPassword,
  type CurrentUser,
} from '@/services/authService'
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} from '@/services/tokenStorage'

export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  const currentUser = ref<CurrentUser | null>(null)
  const isReady = ref(false)
  const isAuthenticated = computed(() => token.value.length > 0)

  function applySession(nextToken: string, nextUser: CurrentUser | null) {
    token.value = nextToken
    currentUser.value = nextUser
  }

  async function clearSession() {
    applySession('', null)
    await clearAuthSession()
  }

  async function initialize() {
    if (isReady.value) {
      return
    }

    const { token: storedToken, user: storedUser } = await readAuthSession()

    if (!storedToken) {
      isReady.value = true
      return
    }

    applySession(storedToken, storedUser)
    isReady.value = true
  }

  async function login(email: string, password: string) {
    const result = await loginWithEmailPassword({ email, password })
    const user = await fetchCurrentUser(result.access_token)
    applySession(result.access_token, user)
    await writeAuthSession({ token: result.access_token, user })
    isReady.value = true
  }

  async function logout() {
    await clearSession()
    isReady.value = true
  }

  return { token, currentUser, isReady, isAuthenticated, initialize, login, logout }
})
