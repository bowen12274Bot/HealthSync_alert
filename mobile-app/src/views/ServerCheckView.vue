<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Capacitor } from '@capacitor/core'

import {
  createLocalRecordRepository,
  getRuntimeStorageLabel,
} from '@/modules/health-records/createLocalRecordRepository'
import type { LocalRecord } from '@/modules/health-records/types'
import { fetchServerHealth, getApiBaseUrl } from '@/services/apiClient'
import type { HealthResponse } from '@/types/api'

const result = ref<HealthResponse | null>(null)
const errorMessage = ref('')
const isLoading = ref(false)
const repository = createLocalRecordRepository()
const localRecords = ref<LocalRecord[]>([])
const localErrorMessage = ref('')
const isSavingLocalRecord = ref(false)
const runtimePlatform = Capacitor.getPlatform()
const storageMode = getRuntimeStorageLabel()
const apiBaseUrl = getApiBaseUrl()

async function handleCheckServer() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    result.value = await fetchServerHealth()
  } catch (error) {
    result.value = null
    errorMessage.value =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : 'Unknown error'
  } finally {
    isLoading.value = false
  }
}

async function refreshLocalRecords() {
  localRecords.value = await repository.list()
}

async function handleSaveLocalRecord() {
  isSavingLocalRecord.value = true
  localErrorMessage.value = ''

  try {
    await repository.save({
      id: crypto.randomUUID(),
      type: 'environment-check',
      payload: {
        source: runtimePlatform,
        note: 'Local repository smoke test',
      },
      createdAt: new Date().toISOString(),
    })
    await refreshLocalRecords()
  } catch (error) {
    localErrorMessage.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    isSavingLocalRecord.value = false
  }
}

async function handleClearLocalRecords() {
  localErrorMessage.value = ''

  try {
    await repository.clear()
    await refreshLocalRecords()
  } catch (error) {
    localErrorMessage.value = error instanceof Error ? error.message : 'Unknown error'
  }
}

onMounted(async () => {
  try {
    await repository.init()
    await refreshLocalRecords()
  } catch (error) {
    localErrorMessage.value = error instanceof Error ? error.message : 'Unknown error'
  }
})
</script>

<template>
  <main class="server-check">
    <section class="panel">
      <p class="eyebrow">HealthSync Alert</p>
      <h1>手機端連線測試</h1>
      <p class="description">
        這個頁面會向 FastAPI 伺服器送出 `GET /health` 請求，確認前後端是否已經打通。
      </p>

      <button class="action" type="button" :disabled="isLoading" @click="handleCheckServer">
        {{ isLoading ? '連線中...' : '測試伺服器連線' }}
      </button>

      <div v-if="result" class="status success">
        <p>連線成功</p>
        <p>status: {{ result.status }}</p>
        <p>service: {{ result.service }}</p>
      </div>

      <div v-if="errorMessage" class="status error">
        <p>連線失敗</p>
        <p>{{ errorMessage }}</p>
      </div>

      <div class="hint">
        <p>開發提示：</p>
        <p>瀏覽器測試可用 `http://127.0.0.1:8000`</p>
        <p>Android Emulator 通常需改成 `http://10.0.2.2:8000`</p>
        <p>目前 API Base URL：`{{ apiBaseUrl }}`</p>
      </div>

      <div class="divider"></div>

      <p class="eyebrow">Local Storage Layer</p>
      <h2>本地資料層測試</h2>
      <p class="description">
        現在先用中性的本地記錄格式驗證資料層切換。Web 會使用 mock repository，原生環境之後再接 SQLite。
      </p>
      <div class="meta">
        <p>platform: {{ runtimePlatform }}</p>
        <p>storage mode: {{ storageMode }}</p>
      </div>

      <div class="actions">
        <button class="action secondary" type="button" :disabled="isSavingLocalRecord" @click="handleSaveLocalRecord">
          {{ isSavingLocalRecord ? '儲存中...' : '新增本地測試資料' }}
        </button>
        <button class="action ghost" type="button" @click="handleClearLocalRecords">清空本地資料</button>
      </div>

      <div v-if="localErrorMessage" class="status error">
        <p>本地資料層錯誤</p>
        <p>{{ localErrorMessage }}</p>
      </div>

      <div class="status neutral">
        <p>目前記錄數：{{ localRecords.length }}</p>
      </div>

      <ul v-if="localRecords.length > 0" class="record-list">
        <li v-for="record in localRecords" :key="record.id" class="record-item">
          <p class="record-type">{{ record.type }}</p>
          <p class="record-time">{{ record.createdAt }}</p>
          <pre>{{ JSON.stringify(record.payload, null, 2) }}</pre>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.server-check {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(91, 141, 239, 0.24), transparent 35%),
    linear-gradient(180deg, #f4f9ff 0%, #eef4f8 100%);
}

.panel {
  width: min(100%, 560px);
  padding: 32px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 60px rgba(19, 52, 88, 0.12);
}

.eyebrow {
  margin: 0 0 12px;
  color: #1b5fcf;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #14304d;
  font-size: clamp(2rem, 6vw, 2.75rem);
  line-height: 1.1;
}

h2 {
  margin: 0;
  color: #14304d;
  font-size: 1.5rem;
  line-height: 1.2;
}

.description {
  margin: 16px 0 24px;
  color: #42607c;
  line-height: 1.6;
}

.action {
  border: 0;
  border-radius: 999px;
  padding: 14px 22px;
  background: #1166dd;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.action:disabled {
  opacity: 0.7;
  cursor: wait;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.secondary {
  background: #0d8a72;
}

.ghost {
  background: #dfe8f3;
  color: #14304d;
}

.status {
  margin-top: 20px;
  padding: 16px;
  border-radius: 16px;
}

.status p {
  margin: 0 0 8px;
}

.status p:last-child {
  margin-bottom: 0;
}

.success {
  background: #eafaf1;
  color: #10643a;
}

.error {
  background: #fff1f1;
  color: #b22a2a;
}

.neutral {
  background: #eef5fb;
  color: #2d536f;
}

.hint {
  margin-top: 24px;
  color: #56708a;
  font-size: 0.95rem;
  line-height: 1.6;
}

.hint p {
  margin: 0;
}

.divider {
  height: 1px;
  margin: 28px 0;
  background: linear-gradient(90deg, transparent, rgba(20, 48, 77, 0.2), transparent);
}

.meta {
  margin: 16px 0 20px;
  color: #56708a;
  font-size: 0.95rem;
}

.meta p {
  margin: 0;
}

.record-list {
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.record-item {
  padding: 16px;
  border-radius: 16px;
  background: #f8fbfd;
  color: #1f3f5b;
}

.record-type,
.record-time {
  margin: 0 0 8px;
}

.record-type {
  font-weight: 700;
}

.record-time {
  color: #56708a;
  font-size: 0.9rem;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
}
</style>
