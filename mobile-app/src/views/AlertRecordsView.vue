<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import AppIcon from '@/components/AppIcon.vue'
import { markConnectionUnavailable, useConnectionStatus } from '@/composables/useConnectionStatus'
import {
  AlertHistoryServiceError,
} from '@/services/alertHistoryService'
import { useAuthStore } from '@/stores/auth'
import { useAlertHistoryStore } from '@/stores/alertHistory'

const HISTORY_LIMIT = 50
type HistoryIconName = 'wave' | 'droplet' | 'warning' | 'heart-pulse'
type HistoryTypeTone = 'heart' | 'spo2' | 'stress' | 'general'

const authStore = useAuthStore()
const alertHistoryStore = useAlertHistoryStore()
const router = useRouter()
const { isOnline } = useConnectionStatus()

const isLoading = ref(false)
const errorMessage = ref('')

const historicalAlerts = computed(() => alertHistoryStore.records)
const isOffline = computed(() => !isOnline.value)
const isEmpty = computed(() => !isLoading.value && !isOffline.value && historicalAlerts.value.length === 0 && !errorMessage.value)

function resolveHistoryIcon(
  alertType: string,
  sourceType: 'realtime' | 'long_term',
): HistoryIconName {
  if (sourceType === 'long_term') {
    return 'wave'
  }
  switch (alertType) {
    case 'spo2_risk':
      return 'droplet'
    case 'heart_rate_high':
      return 'heart-pulse'
    case 'physiological_stress':
      return 'wave'
    default:
      return 'warning'
  }
}

function resolveHistoryTypeTone(
  alertType: string,
  sourceType: 'realtime' | 'long_term',
): HistoryTypeTone {
  if (sourceType === 'long_term') {
    return 'stress'
  }

  switch (alertType) {
    case 'heart_rate_high':
      return 'heart'
    case 'spo2_risk':
      return 'spo2'
    case 'physiological_stress':
      return 'stress'
    default:
      return 'general'
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
          <span class="filter-icon"><AppIcon name="calendar" :size="15" :stroke-width="2.05" /></span>
          <span>全部時間</span>
          <span class="select-caret"><AppIcon name="chevron-down" :size="14" :stroke-width="2.2" /></span>
        </button>
        <button class="filter-select" type="button" aria-label="選擇類型篩選">
          <span class="filter-icon"><AppIcon name="filter" :size="15" :stroke-width="2.05" /></span>
          <span>全部類型</span>
          <span class="select-caret"><AppIcon name="chevron-down" :size="14" :stroke-width="2.2" /></span>
        </button>
        <button class="filter-icon-button" type="button" aria-label="更多篩選">
          <AppIcon name="sort" :size="15" :stroke-width="2.05" />
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
            :class="[
              `severity-${item.displaySeverity}`,
              `tone-${resolveHistoryTypeTone(item.alertType, item.sourceType)}`,
            ]"
            :to="{ name: 'alert-display-history', params: { recordId: item.recordId } }"
          >
            <div class="history-icon">
              <AppIcon
                :name="resolveHistoryIcon(item.alertType, item.sourceType)"
                :size="27"
                :stroke-width="2.65"
              />
            </div>
            <div class="history-copy">
              <span class="history-type">{{ item.title }}</span>
              <div class="history-meta">
                <small>{{ item.timeRangeLabel }}</small>
                <span class="level-chip">{{ item.displaySeverityLabel }}</span>
              </div>
            </div>
            <div class="history-side">
              <span class="detail-link">詳情 <AppIcon name="chevron-right" :size="14" :stroke-width="2.2" /></span>
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
  gap: 16px;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 8px;
}

.filter-select,
.filter-icon-button {
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 8px 18px rgba(35, 63, 103, 0.06),
    inset 0 0 0 1px rgba(51, 82, 116, 0.08);
  color: #566b85;
  font-size: 0.78rem;
  font-weight: 700;
}

.filter-select {
  padding: 10px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.filter-icon-button {
  width: 40px;
  display: grid;
  place-items: center;
}

.filter-icon {
  color: #7a8ba0;
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
}

.select-caret {
  color: #6f8398;
  display: inline-grid;
  place-items: center;
  width: 14px;
  height: 14px;
}

.history-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
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
  padding: 14px 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  text-decoration: none;
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 10px 20px rgba(35, 63, 103, 0.06),
    inset 0 0 0 1px rgba(228, 235, 245, 0.82);
}

.history-icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
}

.history-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.history-type {
  font-size: 0.98rem;
  font-weight: 800;
  line-height: 1.15;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.history-copy small {
  color: #6f819a;
  font-size: 0.75rem;
  line-height: 1.15;
}

.history-side {
  display: grid;
  justify-items: end;
  align-content: center;
}

.detail-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #6d7f98;
  font-size: 0.78rem;
  font-weight: 700;
}

.level-chip {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1.2;
}

.history-end {
  margin: 6px 0 0;
  color: #8d9cb1;
  font-size: 0.77rem;
  font-weight: 600;
  text-align: center;
}

.theme-mild .history-icon {
  color: #52b461;
}

.tone-heart .history-icon,
.tone-heart .history-type {
  color: #e45248;
}

.tone-spo2 .history-icon,
.tone-spo2 .history-type {
  color: #2f73d6;
}

.tone-stress .history-icon,
.tone-stress .history-type {
  color: #49a763;
}

.tone-general .history-icon,
.tone-general .history-type {
  color: #ef8615;
}

.severity-mild .level-chip {
  background: rgba(96, 191, 110, 0.14);
  color: #4eaa63;
}

.severity-moderate .level-chip {
  background: rgba(243, 147, 29, 0.12);
  color: #ef8615;
}

.severity-high .level-chip {
  background: rgba(228, 82, 72, 0.12);
  color: #e45248;
}
</style>
