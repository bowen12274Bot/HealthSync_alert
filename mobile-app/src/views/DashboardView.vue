<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import { useConnectionStatus } from '@/composables/useConnectionStatus'
import { useSimulationControl } from '@/composables/useSimulationControl'

const { isOnline, isPinging, isRetrying, retryCountdownSeconds } = useConnectionStatus()
const router = useRouter()
const { currentScenarioName, simulationStatusText } = useSimulationControl()

function openSimulationView(): void {
  void router.push({ name: 'data-simulation' })
}
</script>

<template>
  <AppShell title="儀表板" :show-profile-shortcut="true">
    <section class="dashboard-grid">
      <button class="status-card" type="button">
        <div class="status-mark is-healthy"></div>
        <div class="status-copy">
          <p class="section-label">健康狀態</p>
          <strong>健康狀態良好</strong>
          <span>目前所有指標在正常範圍內</span>
        </div>
        <div class="status-pill">
          <span>持續健康</span>
          <strong>3 天</strong>
        </div>
      </button>

      <section class="metric-grid">
        <article class="metric-card heart">
          <p>心率</p>
          <strong>72</strong>
          <span>bpm</span>
          <small>正常範圍：50 - 100</small>
        </article>
        <article class="metric-card oxygen">
          <p>血氧</p>
          <strong>98%</strong>
          <span>SpO₂</span>
          <small>正常範圍：95% - 100%</small>
        </article>
        <article class="metric-card hrv">
          <p>HRV</p>
          <strong>58</strong>
          <span>ms</span>
          <small>正常範圍：96 - 100</small>
        </article>
      </section>

      <section class="system-strip">
        <button class="system-card simulation-card" type="button" @click="openSimulationView">
          <p>資料生成</p>
          <strong>{{ currentScenarioName }}</strong>
          <span>{{ simulationStatusText }}</span>
        </button>
        <article class="system-card">
          <p>連線狀態</p>
          <strong :class="{ 'state-online': isOnline, 'state-offline': !isOnline }">
            {{ isOnline ? '已連線' : '離線' }}
          </strong>
          <span>
            {{
              isOnline
                ? '上次同步：剛剛'
                : !isRetrying
                  ? '等待網路恢復'
                  : isPinging
                    ? '重試連線中'
                    : `Retry ${retryCountdownSeconds} 秒`
            }}
          </span>
        </article>
      </section>
    </section>
  </AppShell>
</template>

<style scoped>
.dashboard-grid {
  display: grid;
  gap: 18px;
}

.status-card,
.metric-card,
.system-card {
  border: 0;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(35, 63, 103, 0.1);
}

.status-card {
  padding: 20px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: center;
  text-align: left;
}

.status-mark {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  position: relative;
}

.status-mark::before,
.status-mark::after {
  content: '';
  position: absolute;
  background: #fff;
  border-radius: 999px;
}

.status-mark::before {
  width: 16px;
  height: 4px;
  left: 11px;
  top: 21px;
  transform: rotate(45deg);
}

.status-mark::after {
  width: 24px;
  height: 4px;
  right: 8px;
  top: 18px;
  transform: rotate(-45deg);
}

.is-healthy {
  background: linear-gradient(180deg, #62c655 0%, #37a249 100%);
}

.status-copy {
  display: grid;
  gap: 4px;
}

.section-label {
  margin: 0;
  color: #2c68ae;
  font-size: 0.84rem;
  font-weight: 700;
}

.status-copy strong,
.status-pill strong,
.metric-card strong,
.system-card strong {
  color: #163250;
}

.status-copy strong {
  font-size: 1.2rem;
}

.status-copy span,
.system-card span,
.metric-card small {
  color: #6d8094;
}

.status-pill {
  min-width: 88px;
  padding: 10px 12px;
  border-radius: 18px;
  display: grid;
  justify-items: center;
  gap: 4px;
  background: linear-gradient(180deg, rgba(97, 198, 85, 0.16), rgba(97, 198, 85, 0.08));
}

.status-pill span {
  color: #409a4a;
  font-size: 0.8rem;
  font-weight: 700;
}

.status-pill strong {
  font-size: 1.6rem;
  line-height: 1;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  padding: 18px 14px;
  display: grid;
  gap: 8px;
}

.metric-card p,
.system-card p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
}

.metric-card strong {
  font-size: 2rem;
  line-height: 1;
}

.state-online {
  color: #2f8f4e;
}

.state-offline {
  color: #c14a2e;
}

.metric-card span {
  font-size: 0.88rem;
  font-weight: 700;
}

.metric-card small {
  font-size: 0.73rem;
  line-height: 1.4;
}

.heart p,
.heart span {
  color: #f1645c;
}

.oxygen p,
.oxygen span {
  color: #3374d8;
}

.hrv p,
.hrv span {
  color: #34a56d;
}

.system-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.system-card {
  padding: 18px;
  display: grid;
  gap: 6px;
}

.simulation-card {
  cursor: pointer;
  text-align: left;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
  background:
    radial-gradient(circle at top right, rgba(55, 116, 216, 0.16), transparent 38%),
    rgba(255, 255, 255, 0.92);
}

.simulation-card:hover,
.simulation-card:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 22px 44px rgba(35, 63, 103, 0.14);
}

.simulation-card:focus-visible {
  outline: 2px solid #3374d8;
  outline-offset: 2px;
}
</style>
