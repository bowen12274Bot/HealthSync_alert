import { createApp } from 'vue'

import App from './App.vue'
import { pinia } from './pinia'
import router from './router'
import './styles/app.css'
import { useAuthStore } from './stores/auth'

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  app.use(pinia)

  const authStore = useAuthStore()
  await authStore.initialize()

  app.use(router)
  app.mount('#app')
}

void bootstrap()
