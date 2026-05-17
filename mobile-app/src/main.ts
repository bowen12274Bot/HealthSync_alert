import { createApp } from 'vue'
import { Capacitor } from '@capacitor/core'

import App from './App.vue'
import { getDatabaseConnection } from './db/sqlite'
import { pinia } from './pinia'
import router from './router'
import './styles/app.css'
import { useAuthStore } from './stores/auth'

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  app.use(pinia)

  if (Capacitor.isNativePlatform()) {
    await getDatabaseConnection()
  }

  app.use(router)
  app.mount('#app')

  const authStore = useAuthStore()
  void authStore.initialize()
}

void bootstrap()
