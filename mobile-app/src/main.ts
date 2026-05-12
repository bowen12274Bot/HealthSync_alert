import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor } from '@capacitor/core'
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader'

import App from './App.vue'
import router from './router'
import './styles/app.css'

async function bootstrap(): Promise<void> {
  // 在 Web 平台上，需要先注冊並等待 jeep-sqlite 自定義元素就緒，
  // SQLite 的 web store 才能正常初始化。
  // 手機平台（Android / iOS）由 Capacitor 原生處理，跳過此步驟。
  if (Capacitor.getPlatform() === 'web') {
    defineJeepSqlite(window)
    await customElements.whenDefined('jeep-sqlite')
  }

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

bootstrap().catch(console.error)

