<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isHistoryMode = computed(() => route.meta.alertMode === 'history')
const pageTitle = computed(() => (isHistoryMode.value ? '預警詳情' : '即時預警'))
const statusChipLabel = computed(() => (isHistoryMode.value ? '已解除' : '警戒'))
const alertInfoItems = computed(() =>
  isHistoryMode.value
    ? [
        { label: '預警類型', value: '血氧風險' },
        { label: '最終狀態', value: '已解除' },
        { label: '最高等級', value: '高度' },
        { label: '開始發生時間', value: '2025/05/14 14:32:18' },
        { label: '解除時間', value: '2025/05/14 14:41:09' },
      ]
    : [
        { label: '預警類型', value: '血氧風險' },
        { label: '目前狀態', value: '警戒' },
        { label: '目前風險等級', value: '高度' },
        { label: '最高等級', value: '高度' },
        { label: '開始發生時間', value: '2025/05/14 14:32:18' },
        { label: '更新時間', value: '2025/05/14 14:36:42' },
      ],
)
</script>

<template>
  <AppShell :title="pageTitle">
    <section class="alert-display-layout">
      <section class="alert-hero">
        <div class="alert-banner">
          <div class="alert-icon">!</div>
          <div>
            <p class="section-label warning">發現異常指標</p>
            <strong>多項生理指標異常</strong>
            <span>目前狀態與低活動情境不符</span>
          </div>
          <div class="pending-tag">{{ statusChipLabel }}</div>
        </div>

        <div class="indicator-grid">
          <article class="indicator-card heart">
            <p>HR</p>
            <strong>112 bpm</strong>
            <span>上升 ↑</span>
          </article>
          <article class="indicator-card oxygen">
            <p>SpO₂</p>
            <strong>90%</strong>
            <span>持續下降 ↓</span>
          </article>
          <article class="indicator-card hrv">
            <p>HRV</p>
            <strong>28 ms</strong>
            <span>下降 ↓</span>
          </article>
        </div>

        <div class="summary-card">
          近一分鐘資料顯示，在低活動狀態下出現心率上升、心率變異下降與血氧持續下降，因此形成即時預警。
        </div>
      </section>

      <section class="alert-info">
        <dl class="alert-meta">
          <div v-for="item in alertInfoItems" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
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

.alert-hero,
.alert-info {
  border-radius: 24px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(35, 63, 103, 0.1);
}

.alert-hero {
  background:
    linear-gradient(180deg, rgba(255, 182, 113, 0.28) 0%, rgba(255, 244, 233, 0.94) 100%),
    rgba(255, 255, 255, 0.9);
  display: grid;
  gap: 14px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  padding-bottom: 32px;
}

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

.alert-banner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: start;
}

.alert-icon {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #f59d2a 0%, #ef7e0f 100%);
  color: #fff;
  font-size: 1.2rem;
  font-weight: 800;
}

.section-label {
  margin: 0 0 6px;
  color: #db7b12;
  font-size: 0.8rem;
  font-weight: 700;
}

.alert-banner strong,
.alert-meta dd {
  color: #163250;
}

.alert-banner strong {
  display: block;
  font-size: 1.18rem;
  line-height: 1.25;
}

.alert-banner span,
.alert-meta dt {
  color: #6d8094;
}

.alert-banner span {
  display: block;
  margin-top: 4px;
  font-size: 0.82rem;
  line-height: 1.4;
}

.pending-tag {
  border-radius: 999px;
  padding: 7px 11px;
  background: rgba(241, 127, 17, 0.12);
  color: #d4720f;
  font-size: 0.8rem;
  font-weight: 700;
}

.indicator-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.indicator-card {
  border-radius: 20px;
  padding: 14px 14px;
  display: grid;
  gap: 8px;
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
  font-size: 1.02rem;
  line-height: 1.2;
  font-weight: 650;
}

.indicator-grid span {
  color: #71859a;
  font-size: 0.76rem;
  line-height: 1.35;
}

.heart p {
  color: #f1645c;
}

.oxygen p {
  color: #3374d8;
}

.hrv p {
  color: #34a56d;
}

.summary-card {
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.8);
  color: #35536f;
  font-size: 0.82rem;
  line-height: 1.5;
}

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
</style>
