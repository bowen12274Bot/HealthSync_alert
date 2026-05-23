<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAlertStatus } from '@/composables/useAlertStatus'
import { markConnectionUnavailable, useConnectionStatus } from '@/composables/useConnectionStatus'
import { useLatestHealthRecord } from '@/composables/useLatestHealthRecord'
import { AlertHistoryServiceError } from '@/services/alertHistoryService'
import { useAuthStore } from '@/stores/auth'
import { useAlertHistoryStore } from '@/stores/alertHistory'

const route = useRoute()
const router = useRouter()
const { alertData, isHealthy, alertLevel, alertTitle, alertSubtitle, alertDuration, refreshAlertStatus } =
  useAlertStatus()
const { heartRate, hrv, spO2 } = useLatestHealthRecord()
const authStore = useAuthStore()
const alertHistoryStore = useAlertHistoryStore()
const { isOnline } = useConnectionStatus()

const isHistoryMode = computed(() => route.meta.alertMode === 'history')
const recordId = computed(() => String(route.params.recordId ?? ''))
const historyDetail = computed(() => (
  isHistoryMode.value && recordId.value ? alertHistoryStore.getDetail(recordId.value) : null
))
const isHistoryLoading = ref(false)
const historyErrorMessage = ref('')
const pageTitle = computed(() => (isHistoryMode.value ? '預警詳情' : '即時預警'))
const historyAlertLevel = computed(() => {
  if (historyDetail.value === null) return 'warning'
  switch (historyDetail.value.displaySeverity) {
    case 'mild':
      return 'warning'
    case 'moderate':
      return 'critical'
    default:
      return 'severe'
  }
})
const showHealthyState = computed(() => !isHistoryMode.value && isHealthy.value)

// ── 嚴重程度對應標籤 ──────────────────────────────────────
const statusChipLabel = computed(() => {
  if (isHistoryMode.value) return historyDetail.value?.statusLabel ?? '預警紀錄'
  switch (alertLevel.value) {
    case 'warning':
      return '觀察中'
    case 'critical':
      return '警戒'
    case 'severe':
      return '高度警戒'
    default:
      return '正常'
  }
})

// ── 預警類型中文名稱 ──────────────────────────────────────
const alertTypeName = computed(() => {
  if (isHistoryMode.value) {
    return historyDetail.value?.alertTypeLabel ?? '預警類型'
  }
  switch (alertData.value.alertType) {
    case 'spo2_risk':
      return '血氧風險'
    case 'physiological_stress':
      return '生理壓力'
    case 'combined_physiological_risk':
      return '複合生理風險'
    default:
      return '生理異常'
  }
})

// ── 格式化時間 ────────────────────────────────────────────
function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

// ── 風險分數對應文字 ──────────────────────────────────────
const riskScoreLabel = computed(() => {
  if (isHistoryMode.value) {
    return historyDetail.value?.displaySeverityLabel ?? '—'
  }
  const score = alertData.value.riskScore
  if (score <= 2) return '低'
  if (score <= 4) return '中'
  if (score <= 6) return '高度'
  return '極高'
})

// ── 生命表格項目（即時模式）────────────────────────────────
const alertInfoItems = computed(() => {
  if (isHistoryMode.value) {
    if (historyDetail.value === null) {
      return []
    }

    if (historyDetail.value.sourceType === 'long_term') {
      return [
        { label: '預警類型', value: historyDetail.value.alertTypeLabel },
        { label: '目前狀態', value: historyDetail.value.statusLabel },
        { label: '風險等級', value: historyDetail.value.displaySeverityLabel },
        { label: '分析時間範圍', value: historyDetail.value.timeRangeLabel },
        { label: '最後更新時間', value: formatTime(historyDetail.value.updatedAt) },
      ]
    }

    return [
      { label: '預警類型', value: historyDetail.value.alertTypeLabel },
      { label: '最終狀態', value: historyDetail.value.statusLabel },
      { label: '最高風險評分', value: `${historyDetail.value.maxRiskScore} / 9 分` },
      { label: '開始發生時間', value: formatTime(historyDetail.value.firstOccurredAt) },
      { label: '解除時間', value: formatTime(historyDetail.value.resolvedAt) },
    ]
  }
  return [
    { label: '預警類型', value: alertTypeName.value },
    { label: '目前狀態', value: alertData.value.status ?? '觀察中' },
    { label: '風險評分', value: `${alertData.value.riskScore} / 9 分（${riskScoreLabel.value}）` },
    { label: '開始發生時間', value: formatTime(alertData.value.detectionStartTime) },
    { label: '首次觸發時間', value: formatTime(alertData.value.firstOccurredAt) },
  ]
})

// ── 心率趨勢（簡易判斷） ──────────────────────────────────
const hrTrendLabel = computed(() => {
  const hr = Number(heartRate.value)
  if (isNaN(hr)) return '—'
  if (hr > 100) return '偏高 ↑'
  if (hr < 50) return '偏低 ↓'
  return '正常'
})

const spO2TrendLabel = computed(() => {
  const val = Number(spO2.value)
  if (isNaN(val)) return '—'
  if (val < 90) return '持續下降 ↓'
  if (val < 95) return '略低 ↓'
  return '正常'
})

const hrvTrendLabel = computed(() => {
  const val = Number(hrv.value)
  if (isNaN(val)) return '—'
  if (val < 20) return '下降 ↓'
  if (val > 120) return '偏高 ↑'
  return '正常'
})

const historyTriggerReasons = computed(() => {
  if (historyDetail.value === null) return []

  return historyDetail.value.triggerReason
    .split(/,|\/|\n/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
})

async function loadHistoryDetail(force = false): Promise<void> {
  if (!isHistoryMode.value || !recordId.value) {
    return
  }

  if (!isOnline.value) {
    historyErrorMessage.value = '預警詳情需連線後才能查看'
    return
  }

  if (!authStore.token) {
    historyErrorMessage.value = '登入狀態已失效，請重新登入'
    return
  }

  isHistoryLoading.value = true
  historyErrorMessage.value = ''

  try {
    await alertHistoryStore.ensureDetail(authStore.token, recordId.value, force)
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
      historyErrorMessage.value = error.message
      return
    }
    historyErrorMessage.value = '取得預警詳情失敗，請稍後再試'
  } finally {
    isHistoryLoading.value = false
  }
}

onMounted(() => {
  if (isHistoryMode.value) {
    void loadHistoryDetail()
    return
  }

  void refreshAlertStatus()
})

watch(
  () => recordId.value,
  () => {
    if (isHistoryMode.value) {
      void loadHistoryDetail()
    }
  },
)
</script>

<template>
  <AppShell :title="pageTitle">
    <section class="alert-display-layout">

      <!-- ── 上半段：警報橫幅 + 指標卡 + 觸發原因 ── -->
      <section class="alert-hero" :class="isHistoryMode ? historyAlertLevel : alertLevel">
        <div class="alert-banner">
          <div class="alert-icon" :class="isHistoryMode ? historyAlertLevel : alertLevel">
            <span v-if="showHealthyState">✓</span>
            <span v-else>!</span>
          </div>
          <div>
            <p class="section-label" :class="isHistoryMode ? historyAlertLevel : alertLevel">
              {{
                isHistoryMode
                  ? historyDetail?.historyTypeLabel ?? '歷史預警'
                  : showHealthyState
                    ? '健康狀態良好'
                    : '發現異常指標'
              }}
            </p>
            <strong>{{ isHistoryMode ? historyDetail?.title ?? '預警詳情' : alertTitle }}</strong>
            <span>{{
              isHistoryMode
                ? historyDetail?.summary ?? '正在載入預警詳情'
                : alertSubtitle
            }}</span>
          </div>
          <div class="pending-tag" :class="isHistoryMode ? historyAlertLevel : alertLevel">{{ statusChipLabel }}</div>
        </div>

        <!-- 即時指標卡 -->
        <div v-if="!isHistoryMode" class="indicator-grid">
          <article class="indicator-card heart">
            <p>HR</p>
            <strong>{{ heartRate }} <small>bpm</small></strong>
            <span>{{ hrTrendLabel }}</span>
          </article>
          <article class="indicator-card oxygen">
            <p>SpO₂</p>
            <strong>{{ spO2 }}<small>%</small></strong>
            <span>{{ spO2TrendLabel }}</span>
          </article>
          <article class="indicator-card hrv">
            <p>HRV</p>
            <strong>{{ hrv }} <small>ms</small></strong>
            <span>{{ hrvTrendLabel }}</span>
          </article>
        </div>

        <!-- 持續時間膠囊 -->
        <div v-if="!isHistoryMode" class="duration-pill" :class="alertLevel">
          <span>{{ alertDuration.label }}</span>
          <strong>{{ alertDuration.value }}</strong>
        </div>

        <!-- 觸發原因列表（有預警時才顯示） -->
        <div v-if="isHistoryMode && historyErrorMessage" class="summary-card">
          {{ historyErrorMessage }}
        </div>
        <div v-else-if="isHistoryMode && isHistoryLoading" class="summary-card">
          正在向伺服器取得預警詳情...
        </div>
        <div v-else-if="isHistoryMode && historyTriggerReasons.length > 0" class="reason-block">
          <p class="reason-title">觸發原因</p>
          <ul class="reason-list">
            <li v-for="reason in historyTriggerReasons" :key="reason">
              {{ reason }}
            </li>
          </ul>
        </div>
        <div v-else-if="!showHealthyState && alertData.triggerReasons.length > 0" class="reason-block">
          <p class="reason-title">觸發原因</p>
          <ul class="reason-list">
            <li v-for="reason in alertData.triggerReasons" :key="reason">
              {{ reason }}
            </li>
          </ul>
        </div>

        <!-- 健康說明（無警報時顯示） -->
        <div v-else-if="showHealthyState" class="summary-card healthy">
          目前所有生理指標均在正常範圍內，系統持續監測中。如出現異常，將即時通知您。
        </div>
      </section>

      <!-- ── 下半段：詳細資訊表格 ── -->
      <section class="alert-info">
        <dl class="alert-meta">
          <div v-for="item in alertInfoItems" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
          <div v-if="isHistoryMode && historyDetail?.sourceType === 'realtime' && historyDetail.statusHistory.length > 0">
            <dt>狀態歷程</dt>
            <dd class="history-timeline">
              <span
                v-for="item in historyDetail.statusHistory"
                :key="`${item.statusTime}-${item.status}`"
              >
                {{ formatTime(item.statusTime) }} {{ item.statusLabel }}
              </span>
            </dd>
          </div>
        </dl>
      </section>

    </section>
  </AppShell>
</template>

<style scoped>
.alert-display-layout {
  display: grid;
  gap: 0;
}

/* ── Hero 區塊 ── */
.alert-hero,
.alert-info {
  border-radius: 24px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(35, 63, 103, 0.1);
}

.alert-hero {
  display: grid;
  gap: 14px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  padding-bottom: 32px;

  /* 預設（健康）配色 */
  background:
    linear-gradient(180deg, rgba(97, 198, 85, 0.15) 0%, rgba(240, 255, 240, 0.94) 100%),
    rgba(255, 255, 255, 0.9);
}

.alert-hero.warning {
  background:
    linear-gradient(180deg, rgba(255, 193, 7, 0.22) 0%, rgba(255, 248, 225, 0.94) 100%),
    rgba(255, 255, 255, 0.9);
}

.alert-hero.critical {
  background:
    linear-gradient(180deg, rgba(255, 152, 0, 0.22) 0%, rgba(255, 244, 230, 0.94) 100%),
    rgba(255, 255, 255, 0.9);
}

.alert-hero.severe {
  background:
    linear-gradient(180deg, rgba(244, 67, 54, 0.2) 0%, rgba(255, 235, 238, 0.94) 100%),
    rgba(255, 255, 255, 0.9);
}

/* ── Info 區塊 ── */
.alert-info {
  position: relative;
  margin-top: -18px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 18px 40px rgba(35, 63, 103, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  padding-top: 20px;
}

.alert-info::before {
  content: '';
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  border-top: 1px solid rgba(22, 50, 80, 0.08);
}

/* ── Banner ── */
.alert-banner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: start;
}

/* ── Icon ── */
.alert-icon {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 1.3rem;
  font-weight: 800;
  background: linear-gradient(180deg, #62c655 0%, #37a249 100%);
  box-shadow: 0 4px 12px rgba(98, 198, 85, 0.35);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.alert-icon.warning {
  background: linear-gradient(180deg, #ffc107 0%, #ff9800 100%);
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.35);
}

.alert-icon.critical {
  background: linear-gradient(180deg, #ff9800 0%, #f44336 100%);
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
}

.alert-icon.severe {
  background: linear-gradient(180deg, #f44336 0%, #c62828 100%);
  box-shadow: 0 4px 12px rgba(198, 40, 40, 0.5);
  animation: pulse-severe 1.4s ease-in-out infinite;
}

@keyframes pulse-severe {
  0%, 100% { box-shadow: 0 4px 12px rgba(198, 40, 40, 0.5); }
  50%       { box-shadow: 0 6px 20px rgba(198, 40, 40, 0.75); }
}

/* ── Section label ── */
.section-label {
  margin: 0 0 6px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #37a249;
}

.section-label.warning  { color: #db7b12; }
.section-label.critical { color: #c94a00; }
.section-label.severe   { color: #b71c1c; }

/* ── Banner text ── */
.alert-banner strong {
  display: block;
  font-size: 1.18rem;
  line-height: 1.25;
  color: #163250;
}

.alert-banner span {
  display: block;
  margin-top: 4px;
  font-size: 0.82rem;
  line-height: 1.4;
  color: #6d8094;
}

/* ── Status chip ── */
.pending-tag {
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 0.8rem;
  font-weight: 700;
  background: rgba(55, 162, 73, 0.12);
  color: #2f8c46;
  white-space: nowrap;
}

.pending-tag.warning  { background: rgba(241, 127, 17, 0.12); color: #d4720f; }
.pending-tag.critical { background: rgba(244, 67, 54, 0.1);   color: #c33000; }
.pending-tag.severe   { background: rgba(198, 40, 40, 0.14);  color: #b71c1c; }

/* ── Duration pill ── */
.duration-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 0.84rem;
  width: fit-content;
  background: rgba(55, 162, 73, 0.1);
  color: #2f8c46;
}

.duration-pill span { font-weight: 600; }
.duration-pill strong { font-size: 1rem; font-weight: 700; }

.duration-pill.warning  { background: rgba(255, 152, 0, 0.1); color: #d4720f; }
.duration-pill.critical { background: rgba(244, 67, 54, 0.08); color: #c33000; }
.duration-pill.severe   { background: rgba(198, 40, 40, 0.1);  color: #b71c1c; }

/* ── 觸發原因 ── */
.reason-block {
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.8);
}

.reason-title {
  margin: 0 0 10px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #6d8094;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.reason-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.reason-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.84rem;
  line-height: 1.45;
  color: #35536f;
}

.reason-list li::before {
  content: '•';
  font-size: 1rem;
  line-height: 1.35;
  color: #e65100;
  flex-shrink: 0;
}

/* ── 健康說明卡片 ── */
.summary-card {
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
  line-height: 1.5;
}

.summary-card.healthy { color: #2e6b3a; }

/* ── 指標卡格 ── */
.indicator-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.indicator-card {
  border-radius: 20px;
  padding: 14px;
  display: grid;
  gap: 6px;
  background: rgba(255, 255, 255, 0.86);
}

.indicator-grid p,
.indicator-grid span {
  margin: 0;
}

.indicator-grid p {
  font-size: 0.82rem;
  font-weight: 700;
}

.indicator-grid strong {
  font-size: 1.05rem;
  line-height: 1.2;
  font-weight: 700;
  color: #163250;
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.indicator-grid strong small {
  font-size: 0.7rem;
  font-weight: 600;
  color: #6d8094;
}

.indicator-grid span {
  color: #71859a;
  font-size: 0.76rem;
  line-height: 1.35;
}

.heart p  { color: #f1645c; }
.oxygen p { color: #3374d8; }
.hrv p    { color: #34a56d; }

/* ── Meta 表格 ── */
.alert-meta {
  margin: 0;
  display: grid;
  gap: 0;
}

.alert-meta div {
  display: grid;
  gap: 4px;
  padding: 12px 0;
}

.alert-meta div + div {
  border-top: 1px solid rgba(22, 50, 80, 0.08);
}

.alert-meta dt,
.alert-meta dd {
  margin: 0;
}

.alert-meta dt {
  font-size: 0.8rem;
  color: #6d8094;
}

.alert-meta dd {
  font-size: 0.95rem;
  font-weight: 600;
  color: #163250;
}

.history-timeline {
  display: grid;
  gap: 8px;
}

.history-timeline span {
  display: block;
  color: #35536f;
  font-size: 0.84rem;
  line-height: 1.45;
}
</style>
