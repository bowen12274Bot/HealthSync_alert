<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'

const trendCards = [
  { title: '心率趨勢', value: '最近 7 天', tone: 'heart' },
  { title: '血氧趨勢', value: '最近 7 天', tone: 'oxygen' },
  { title: 'HRV 趨勢', value: '最近 7 天', tone: 'hrv' },
]
</script>

<template>
  <AppShell title="趨勢報表">
    <section class="trends-layout">
      <section class="switch-card">
        <div class="range-switch" aria-label="趨勢範圍">
          <button class="range-button is-active" type="button">短期</button>
          <button class="range-button" type="button">長期</button>
        </div>
      </section>

      <article v-for="card in trendCards" :key="card.title" class="trend-card">
        <div class="trend-header">
          <div>
            <p class="metric-name" :class="card.tone">{{ card.title }}</p>
            <span>{{ card.value }}</span>
          </div>
          <button class="filter-chip" type="button">最近 7 天</button>
        </div>
        <div class="trend-graph" :class="card.tone"></div>
      </article>

      <section class="summary-card">
        <p class="section-label">趨勢摘要概覽</p>
        <div class="summary-grid">
          <article>
            <span>心率</span>
            <strong>+3 bpm</strong>
          </article>
          <article>
            <span>血氧</span>
            <strong>-1%</strong>
          </article>
          <article>
            <span>HRV</span>
            <strong>+5 ms</strong>
          </article>
        </div>
      </section>
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
.summary-card {
  padding: 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(35, 63, 103, 0.1);
}

.switch-card {
  padding: 16px;
}

.section-label,
.metric-name {
  margin: 0 0 6px;
  font-size: 0.9rem;
  font-weight: 700;
}

.section-label {
  color: #2c68ae;
}

.summary-grid strong {
  color: #163250;
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

.trend-card {
  display: grid;
  gap: 16px;
}

.trend-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.trend-header span {
  color: #6d8094;
  font-size: 0.84rem;
}

.metric-name.heart {
  color: #f1645c;
}

.metric-name.oxygen {
  color: #3374d8;
}

.metric-name.hrv {
  color: #34a56d;
}

.filter-chip {
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  background: #edf3fb;
  color: #335274;
  font-size: 0.82rem;
  font-weight: 700;
}

.trend-graph {
  height: 120px;
  border-radius: 18px;
  background-size: 100% 100%;
}

.trend-graph.heart {
  background:
    linear-gradient(180deg, rgba(241, 100, 92, 0.18), transparent),
    linear-gradient(120deg, transparent 10%, #f1645c 10%, transparent 20%, #f1645c 36%, transparent 48%, #f1645c 60%, transparent 74%, #f1645c 88%, transparent 100%);
}

.trend-graph.oxygen {
  background:
    linear-gradient(180deg, rgba(51, 116, 216, 0.18), transparent),
    linear-gradient(120deg, transparent 8%, #3374d8 18%, transparent 30%, #3374d8 42%, transparent 58%, #3374d8 74%, transparent 90%);
}

.trend-graph.hrv {
  background:
    linear-gradient(180deg, rgba(52, 165, 109, 0.18), transparent),
    linear-gradient(120deg, transparent 14%, #34a56d 26%, transparent 36%, #34a56d 52%, transparent 68%, #34a56d 80%, transparent 94%);
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
}
</style>
