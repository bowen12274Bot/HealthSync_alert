<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import TrendLineChart from '@/components/TrendLineChart.vue'
import { markConnectionUnavailable } from '@/composables/useConnectionStatus'
import {
  buildShortTermTrendReport,
  fetchLongTermTrendReport,
  TrendReportServiceError,
} from '@/services/trendReportService'
import { useAuthStore } from '@/stores/auth'

import type { TrendMetricKey, TrendMetricReport, TrendReport } from '@/types/trendReport'

const router = useRouter()
const authStore = useAuthStore()

const selectedMode = ref<'short_term' | 'long_term'>('short_term')
const selectedMonth = ref(formatMonthKey(new Date()))

const shortReport = ref<TrendReport | null>(null)
const longReport = ref<TrendReport | null>(null)
const isShortLoading = ref(false)
const isLongLoading = ref(false)
const shortErrorMessage = ref('')
const longErrorMessage = ref('')

const displayedReport = computed(() =>
  selectedMode.value === 'short_term' ? shortReport.value : longReport.value,
)
const isLoading = computed(() =>
  selectedMode.value === 'short_term' ? isShortLoading.value : isLongLoading.value,
)
const errorMessage = computed(() =>
  selectedMode.value === 'short_term' ? shortErrorMessage.value : longErrorMessage.value,
)
const hasReportData = computed(() =>
  (displayedReport.value?.metrics ?? []).some((metric) => metric.points.length > 0),
)
const currentMonthKey = computed(() => formatMonthKey(new Date()))
const canGoToNextMonth = computed(() => selectedMonth.value < currentMonthKey.value)
const summaryMetrics = computed(() => displayedReport.value?.metrics ?? [])
const alertHint = computed(() =>
  selectedMode.value === 'long_term' ? displayedReport.value?.alertHint : undefined,
)

function formatMonthKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function shiftMonth(monthKey: string, offset: number): string {
  const [yearPart, monthPart] = monthKey.split('-')
  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1
  const nextDate = new Date(year, monthIndex + offset, 1)
  return formatMonthKey(nextDate)
}

function formatMonthLabel(monthKey: string): string {
  const [yearPart, monthPart] = monthKey.split('-')
  return `${yearPart}/${monthPart}`
}

function metricTone(key: TrendMetricKey): 'heart' | 'spo2' | 'hrv' {
  if (key === 'hr') return 'heart'
  if (key === 'spo2') return 'spo2'
  return 'hrv'
}

function formatAverage(metric: TrendMetricReport): string {
  if (metric.summary.average === null) {
    return '--'
  }
  return `${metric.summary.average}${metric.unit}`
}

function formatDelta(metric: TrendMetricReport): string {
  if (metric.summary.deltaFromPrevious === null) {
    return '--'
  }

  const prefix = metric.summary.deltaFromPrevious > 0 ? '+' : ''
  return `${prefix}${metric.summary.deltaFromPrevious}${metric.unit}`
}

async function loadShortReport(force = false): Promise<void> {
  if (!force && shortReport.value !== null) {
    return
  }

  isShortLoading.value = true
  shortErrorMessage.value = ''

  try {
    shortReport.value = await buildShortTermTrendReport()
  } catch (error) {
    shortErrorMessage.value = error instanceof Error ? error.message : '載入短期趨勢失敗'
  } finally {
    isShortLoading.value = false
  }
}

async function loadLongReport(force = false): Promise<void> {
  if (!authStore.token) {
    longErrorMessage.value = '登入狀態已失效，請重新登入'
    return
  }

  if (!force && longReport.value !== null && longReport.value.window.month === selectedMonth.value) {
    return
  }

  isLongLoading.value = true
  longErrorMessage.value = ''

  try {
    longReport.value = await fetchLongTermTrendReport(authStore.token, selectedMonth.value)
  } catch (error) {
    if (error instanceof TrendReportServiceError) {
      if (error.code === 'unauthorized') {
        await authStore.logout()
        void router.push({ name: 'login' })
        return
      }

      if (error.code === 'network') {
        markConnectionUnavailable()
      }

      longErrorMessage.value = error.message
      return
    }

    longErrorMessage.value = '載入長期趨勢失敗'
  } finally {
    isLongLoading.value = false
  }
}

function showPreviousMonth(): void {
  selectedMonth.value = shiftMonth(selectedMonth.value, -1)
}

function showNextMonth(): void {
  if (!canGoToNextMonth.value) {
    return
  }
  selectedMonth.value = shiftMonth(selectedMonth.value, 1)
}

onMounted(() => {
  void loadShortReport()
})

watch(
  () => selectedMode.value,
  (mode) => {
    if (mode === 'short_term') {
      void loadShortReport()
      return
    }
    void loadLongReport()
  },
)

watch(
  () => selectedMonth.value,
  () => {
    if (selectedMode.value === 'long_term') {
      void loadLongReport(true)
    }
  },
)
</script>

<template>
  <AppShell title="趨勢報表">
    <section class="trends-layout">
      <section class="switch-card">
        <div class="range-switch" aria-label="趨勢範圍">
          <button
            class="range-button"
            :class="{ 'is-active': selectedMode === 'short_term' }"
            type="button"
            @click="selectedMode = 'short_term'"
          >
            短期
          </button>
          <button
            class="range-button"
            :class="{ 'is-active': selectedMode === 'long_term' }"
            type="button"
            @click="selectedMode = 'long_term'"
          >
            長期
          </button>
        </div>

        <div v-if="selectedMode === 'long_term'" class="month-switch">
          <button class="month-nav" type="button" @click="showPreviousMonth">上一月</button>
          <strong>{{ formatMonthLabel(selectedMonth) }}</strong>
          <button
            class="month-nav"
            type="button"
            :disabled="!canGoToNextMonth"
            @click="showNextMonth"
          >
            下一月
          </button>
        </div>
      </section>

      <section v-if="isLoading" class="state-card">
        {{ selectedMode === 'short_term' ? '正在整理本地趨勢資料...' : '正在向伺服器取得長期趨勢資料...' }}
      </section>

      <section v-else-if="errorMessage" class="state-card is-error">
        {{ errorMessage }}
      </section>

      <template v-else>
        <article
          v-for="metric in displayedReport?.metrics ?? []"
          :key="metric.key"
          class="trend-card"
        >
          <div class="trend-header">
            <div>
              <p class="metric-name" :class="metricTone(metric.key)">{{ metric.label }}</p>
              <span>{{ metric.rangeLabel }}</span>
            </div>
            <div class="metric-badge">
              <strong>{{ formatAverage(metric) }}</strong>
              <small>相較前視窗 {{ formatDelta(metric) }}</small>
            </div>
          </div>

          <TrendLineChart
            :points="metric.points"
            :tone="metricTone(metric.key)"
          />
        </article>

        <section class="summary-card">
          <div class="summary-head">
            <div>
              <p class="section-label">
                {{ selectedMode === 'short_term' ? '短期摘要概覽' : '長期摘要概覽' }}
              </p>
              <span>{{ displayedReport?.window.label ?? '—' }}</span>
            </div>
            <div
              v-if="selectedMode === 'long_term' && alertHint?.hasAlert"
              class="alert-hint"
            >
              <strong>{{ alertHint.latestAlertTypeLabel }}</strong>
              <small>{{ alertHint.latestSeverityLabel }} · {{ alertHint.count }} 筆</small>
            </div>
          </div>

          <div class="summary-grid">
            <article v-for="metric in summaryMetrics" :key="metric.key">
              <span>{{ metric.key.toUpperCase() }}</span>
              <strong>{{ formatAverage(metric) }}</strong>
              <small>變化 {{ formatDelta(metric) }}</small>
            </article>
          </div>

          <p v-if="selectedMode === 'long_term' && alertHint?.hasAlert && alertHint.latestTriggerReason" class="hint-copy">
            最近長期預警：{{ alertHint.latestTriggerReason }}
          </p>
          <p v-else-if="!hasReportData" class="hint-copy">
            當前視窗內資料不足，部分卡片可能無法繪製趨勢線。
          </p>
        </section>
      </template>
    </section>
  </AppShell>
</template>

<style scoped>
.trends-layout {
  display: grid;
  gap: 16px;
}

.switch-card,
.trend-card,
.summary-card,
.state-card {
  padding: 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(35, 63, 103, 0.1);
}

.switch-card {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.range-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 4px;
  border-radius: 18px;
  background: #ebf1f7;
}

.range-button {
  border: 0;
  border-radius: 14px;
  padding: 12px 0;
  background: transparent;
  color: #61758c;
  font-size: 0.95rem;
  font-weight: 700;
}

.range-button.is-active {
  background: #fff;
  color: #173d68;
  box-shadow: 0 10px 20px rgba(27, 65, 111, 0.08);
}

.month-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.month-switch strong {
  color: #163250;
  font-size: 1rem;
}

.month-nav {
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  background: #edf3fb;
  color: #335274;
  font-size: 0.82rem;
  font-weight: 700;
}

.month-nav:disabled {
  opacity: 0.45;
}

.state-card {
  color: #48627c;
  font-size: 0.92rem;
  font-weight: 700;
}

.state-card.is-error {
  background: #fff3f2;
  color: #c14636;
}

.trend-card {
  display: grid;
  gap: 16px;
}

.trend-header,
.summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.metric-name,
.section-label {
  margin: 0 0 6px;
  font-size: 0.9rem;
  font-weight: 800;
}

.metric-name.heart {
  color: #f1645c;
}

.metric-name.spo2 {
  color: #3374d8;
}

.metric-name.hrv {
  color: #34a56d;
}

.trend-header span,
.summary-head span,
.metric-badge small,
.summary-grid small,
.hint-copy {
  color: #6d8094;
}

.metric-badge {
  min-width: 110px;
  border-radius: 18px;
  padding: 12px 14px;
  display: grid;
  gap: 4px;
  background: #f4f8fc;
}

.metric-badge strong,
.summary-grid strong,
.month-switch strong,
.alert-hint strong {
  color: #163250;
}

.metric-badge strong {
  font-size: 1rem;
}

.metric-badge small {
  font-size: 0.72rem;
  line-height: 1.35;
}

.summary-card {
  display: grid;
  gap: 16px;
}

.section-label {
  color: #2c68ae;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-grid article {
  padding: 14px;
  border-radius: 18px;
  background: #f5f8fc;
  display: grid;
  gap: 8px;
}

.summary-grid span {
  color: #6d8094;
  font-size: 0.82rem;
  font-weight: 800;
}

.summary-grid strong {
  font-size: 1.08rem;
}

.summary-grid small {
  font-size: 0.75rem;
  line-height: 1.35;
}

.alert-hint {
  min-width: 110px;
  border-radius: 18px;
  padding: 12px 14px;
  display: grid;
  gap: 4px;
  background: linear-gradient(180deg, rgba(255, 193, 7, 0.14), rgba(244, 67, 54, 0.06));
}

.alert-hint small {
  color: #8e5e1d;
  font-size: 0.72rem;
  line-height: 1.35;
}

.hint-copy {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}
</style>
