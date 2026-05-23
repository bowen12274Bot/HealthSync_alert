<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import { markConnectionUnavailable, useConnectionStatus } from '@/composables/useConnectionStatus'
import {
  AlertHistoryServiceError,
} from '@/services/alertHistoryService'
import { useAuthStore } from '@/stores/auth'
import { useAlertHistoryStore } from '@/stores/alertHistory'

const HISTORY_LIMIT = 50

const authStore = useAuthStore()
const alertHistoryStore = useAlertHistoryStore()
const router = useRouter()
const { isOnline } = useConnectionStatus()

const isLoading = ref(false)
const errorMessage = ref('')

const historicalAlerts = computed(() => alertHistoryStore.records)
const isOffline = computed(() => !isOnline.value)
const isEmpty = computed(() => !isLoading.value && !isOffline.value && historicalAlerts.value.length === 0 && !errorMessage.value)

function resolveHistoryIcon(alertType: string, sourceType: 'realtime' | 'long_term'): string {
  if (sourceType === 'long_term') {
    return '~'
  }
  switch (alertType) {
    case 'spo2_risk':
      return 'O'
    case 'physiological_stress':
      return '~'
    default:
      return '!'
  }
}

async function loadAlertHistory(force = false): Promise<void> {
  if (!isOnline.value) {
    errorMessage.value = ''
    return
  }

  if (!authStore.token) {
    errorMessage.value = '登入狀態已失效，請重新登入'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await alertHistoryStore.ensureRecords(authStore.token, HISTORY_LIMIT, force)
  } catch (error) {
    if (error instanceof AlertHistoryServiceError) {
      if (error.code === 'unauthorized') {
        await authStore.logout()
        void router.push({ name: 'login' })
        return
      }
      if (error.code === 'network') {
        markConnectionUnavailable()
      }
      errorMessage.value = error.message
      return
    }
    errorMessage.value = '取得預警紀錄失敗，請稍後再試'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadAlertHistory()
})

watch(isOnline, (nextIsOnline) => {
  if (nextIsOnline && historicalAlerts.value.length === 0) {
    void loadAlertHistory()
  }
})
</script>

<template>
  <AppShell title="歷史紀錄">
    <section class="history-layout">
      <div class="filter-row">
        <button class="filter-select" type="button" aria-label="選擇時間篩選">
          <span class="filter-icon">◷</span>
          <span>全部時間</span>
          <span class="select-caret">v</span>
        </button>
        <button class="filter-select" type="button" aria-label="選擇類型篩選">
          <span class="filter-icon">⌯</span>
          <span>全部類型</span>
          <span class="select-caret">v</span>
        </button>
        <button class="filter-icon-button" type="button" aria-label="更多篩選">
          <span>⇅</span>
        </button>
      </div>

      <ul class="history-list">
        <li v-if="isOffline" class="history-state-card">
          <p class="history-state-title">目前無法查看</p>
          <p class="history-state-copy">預警紀錄需連線後才能查看</p>
        </li>
        <li v-else-if="isLoading" class="history-state-card">
          <p class="history-state-title">載入中</p>
          <p class="history-state-copy">正在向伺服器取得預警紀錄</p>
        </li>
        <li v-else-if="errorMessage" class="history-state-card">
          <p class="history-state-title">載入失敗</p>
          <p class="history-state-copy">{{ errorMessage }}</p>
          <button class="state-action" type="button" @click="loadAlertHistory(true)">重新整理</button>
        </li>
        <li v-else-if="isEmpty" class="history-state-card">
          <p class="history-state-title">目前沒有歷史預警紀錄</p>
          <p class="history-state-copy">當伺服器收到完整預警後，會顯示在這裡</p>
        </li>
        <li v-for="item in historicalAlerts" v-else :key="item.recordId">
          <RouterLink
            class="history-item"
            :class="`theme-${item.displaySeverity}`"
            :to="{ name: 'alert-display-history', params: { recordId: item.recordId } }"
          >
            <div class="history-icon">{{ resolveHistoryIcon(item.alertType, item.sourceType) }}</div>
            <div class="history-copy">
              <span class="history-type">{{ item.title }}</span>
              <small>{{ item.timeRangeLabel }}</small>
            </div>
            <div class="history-side">
              <span class="level-chip">{{ item.displaySeverityLabel }}</span>
              <span class="detail-link">詳情</span>
            </div>
          </RouterLink>
        </li>
      </ul>

      <p v-if="historicalAlerts.length > 0" class="history-end">已載入全部紀錄</p>
    </section>
  </AppShell>
</template>

<style scoped>
.history-layout {
  display: grid;
  gap: 14px;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;
}

.filter-select,
.filter-icon-button {
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow:
    0 10px 24px rgba(35, 63, 103, 0.08),
    inset 0 0 0 1px rgba(51, 82, 116, 0.08);
  color: #4b6280;
  font-size: 0.82rem;
  font-weight: 700;
}

.filter-select {
  padding: 12px 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.filter-icon-button {
  width: 42px;
  display: grid;
  place-items: center;
}

.filter-icon {
  color: #7a8ba0;
  font-size: 0.8rem;
  line-height: 1;
}

.select-caret {
  color: #6f8398;
  font-size: 0.76rem;
  line-height: 1;
}

.history-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.history-state-card {
  border-radius: 18px;
  padding: 18px 16px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 28px rgba(35, 63, 103, 0.08);
  display: grid;
  gap: 8px;
}

.history-state-title,
.history-state-copy {
  margin: 0;
}

.history-state-title {
  color: #163250;
  font-size: 0.92rem;
  font-weight: 700;
}

.history-state-copy {
  color: #6d8094;
  font-size: 0.8rem;
  line-height: 1.5;
}

.state-action {
  width: fit-content;
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  background: #174f96;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
}

.history-item {
  padding: 14px 16px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  text-decoration: none;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 28px rgba(35, 63, 103, 0.08);
}

.history-icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
}

.history-copy {
  display: grid;
  gap: 4px;
}

.history-type {
  font-size: 0.8rem;
  font-weight: 700;
}

.history-copy small {
  color: var(--text-secondary);
  font-size: 0.76rem;
}

.history-side {
  display: grid;
  justify-items: end;
  gap: 10px;
}

.level-chip {
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 0.76rem;
  font-weight: 700;
}

.detail-link {
  font-size: 0.8rem;
  font-weight: 700;
}

.history-end {
  margin: 2px 0 0;
  color: #93a3b6;
  font-size: 0.78rem;
  text-align: center;
}

.theme-mild .history-icon {
  background: linear-gradient(180deg, #69c87a 0%, #45a95d 100%);
}

.theme-mild .history-type,
.theme-mild .detail-link {
  color: #34a56d;
}

.theme-mild .level-chip {
  background: rgba(52, 165, 109, 0.14);
  color: #34a56d;
}

.theme-moderate .history-icon {
  background: linear-gradient(180deg, #f59d2a 0%, #ef7e0f 100%);
}

.theme-moderate .history-type,
.theme-moderate .detail-link {
  color: #d4720f;
}

.theme-moderate .level-chip {
  background: rgba(241, 127, 17, 0.12);
  color: #d4720f;
}

.theme-high .history-icon {
  background: linear-gradient(180deg, #f06d61 0%, #d94e45 100%);
}

.theme-high .history-type,
.theme-high .detail-link {
  color: #d94e45;
}

.theme-high .level-chip {
  background: rgba(217, 78, 69, 0.12);
  color: #d94e45;
}
</style>
