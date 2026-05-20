<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const email = ref(import.meta.env.VITE_DEV_LOGIN_EMAIL ?? 'demo@healthsync.local')
const password = ref(import.meta.env.VITE_DEV_LOGIN_PASSWORD ?? 'healthsync-demo')
const errorMessage = ref('')
const canAutoRedirect = computed(() => authStore.isAuthenticated && !authStore.isLoginPending)

watch(
  canAutoRedirect,
  async (isReadyToRedirect) => {
    if (!isReadyToRedirect) {
      return
    }

    const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirectPath)
  },
  { immediate: true },
)

async function handleLogin() {
  errorMessage.value = ''

  try {
    await authStore.login(email.value.trim(), password.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登入失敗'
  } finally {
    if (!authStore.isAuthenticated) {
      authStore.resetLoginPhase()
    }
  }
}
</script>

<template>
  <main class="login-shell">
    <section class="login-frame">
      <div class="login-screen">
        <section class="login-panel">
          <div class="brand-block">
            <p>HealthSync Alert</p>
            <h1>登入</h1>
          </div>

          <form class="login-form" @submit.prevent="handleLogin">
            <label class="field-group">
              <span>Email</span>
              <input
                v-model="email"
                type="email"
                autocomplete="username"
                :disabled="authStore.isLoginPending"
                required
              />
            </label>

            <label class="field-group">
              <span>密碼</span>
              <input
                v-model="password"
                type="password"
                autocomplete="current-password"
                :disabled="authStore.isLoginPending"
                required
              />
            </label>

            <div class="message-slot">
              <p
                class="status-message"
                :class="{ 'is-visible': authStore.loginStatusMessage.length > 0 }"
              >
                {{ authStore.loginStatusMessage || ' ' }}
              </p>
              <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
            </div>

            <button class="login-button" type="submit" :disabled="authStore.isLoginPending">
              {{ authStore.isLoginPending ? '登入中...' : '登入' }}
            </button>
          </form>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-shell {
  min-height: 100dvh;
  padding: 28px 18px;
  display: grid;
  place-items: center;
}

.login-frame {
  width: min(100%, var(--app-device-width));
  border-radius: 34px;
  padding: 10px;
  background: linear-gradient(180deg, #fefefe 0%, #cad6e8 100%);
  box-shadow:
    0 26px 70px rgba(18, 42, 78, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.login-screen {
  min-height: calc(100dvh - 56px);
  height: min(calc(100dvh - 56px), 915px);
  display: grid;
  align-items: center;
  border-radius: 26px;
  padding: calc(24px + env(safe-area-inset-top, 0px)) 22px
    calc(24px + env(safe-area-inset-bottom, 0px));
  background:
    radial-gradient(circle at top right, rgba(131, 183, 255, 0.22), transparent 30%),
    linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
  overflow: hidden;
}

.login-panel {
  display: grid;
  gap: 34px;
}

.brand-block {
  display: grid;
  gap: 8px;
}

.brand-block p {
  margin: 0;
  color: #2c68ae;
  font-size: 0.92rem;
  font-weight: 800;
}

.brand-block h1 {
  margin: 0;
  color: #14304d;
  font-size: 2.3rem;
  line-height: 1.1;
}

.login-form {
  display: grid;
  gap: 18px;
}

.field-group {
  display: grid;
  gap: 8px;
}

.field-group span {
  color: #35536f;
  font-size: 0.9rem;
  font-weight: 800;
}

.field-group input {
  width: 100%;
  border: 1px solid rgba(51, 82, 116, 0.12);
  border-radius: 16px;
  padding: 15px 16px;
  background: rgba(255, 255, 255, 0.9);
  color: #163250;
  font-size: 1rem;
  outline: none;
  box-shadow: 0 14px 32px rgba(35, 63, 103, 0.08);
}

.field-group input:focus {
  border-color: rgba(44, 104, 174, 0.55);
}

.error-message {
  margin: 0;
  border-radius: 14px;
  padding: 12px 14px;
  background: #fff1f1;
  color: #b22a2a;
  font-size: 0.9rem;
  font-weight: 700;
}

.message-slot {
  min-height: 52px;
}

.status-message {
  margin: 0;
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(44, 104, 174, 0.1);
  color: #2c68ae;
  font-size: 0.9rem;
  font-weight: 700;
  opacity: 0;
  transition: opacity 160ms ease;
}

.status-message.is-visible {
  opacity: 1;
}

.login-button {
  border: 0;
  border-radius: 18px;
  padding: 16px;
  background: #174f96;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  box-shadow: 0 16px 26px rgba(23, 79, 150, 0.2);
}

.login-button:disabled {
  opacity: 0.72;
  cursor: wait;
}

@media (max-width: 480px) {
  .login-shell {
    padding: 0;
  }

  .login-frame {
    width: 100%;
    padding: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .login-screen {
    min-height: 100dvh;
    height: 100dvh;
    border-radius: 0;
  }
}
</style>
