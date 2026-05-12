<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'

const historicalAlerts = [
  { type: '即時預警', title: '發現異常指標', time: '2025/05/14 14:32', level: '中度' },
  { type: '即時預警', title: '心率過高', time: '2025/05/14 10:18', level: '高度' },
  { type: '即時預警', title: '血氧過低', time: '2025/05/13 21:47', level: '中度' },
  { type: '長期預警', title: 'HRV 過低', time: '2025/05/12 18:03', level: '輕度' },
]
</script>

<template>
  <AppShell title="預警紀錄">
    <section class="alerts-layout">
      <section class="current-alert">
        <div class="alert-banner">
          <div class="alert-icon">!</div>
          <div>
            <p class="section-label warning">即時預警</p>
            <strong>發現異常指標</strong>
            <span>部分指標超出正常範圍</span>
          </div>
          <div class="pending-tag">未處理</div>
        </div>

        <div class="current-metrics">
          <article>
            <p>心率 (HR)</p>
            <strong>112 bpm</strong>
            <span>正常範圍：50 - 100</span>
          </article>
          <article>
            <p>血氧濃度 (SpO₂)</p>
            <strong>90%</strong>
            <span>正常範圍：95% - 100%</span>
          </article>
        </div>

        <dl class="alert-meta">
          <div>
            <dt>警戒等級</dt>
            <dd>中度</dd>
          </div>
          <div>
            <dt>發生時間</dt>
            <dd>2025/05/14 14:32</dd>
          </div>
          <div>
            <dt>狀態</dt>
            <dd>未處理</dd>
          </div>
        </dl>
      </section>

      <section class="history-section">
        <div class="history-header">
          <div>
            <p class="section-label">歷史紀錄</p>
            <strong>歷史預警列表</strong>
          </div>
          <div class="filter-row">
            <button class="filter-select" type="button" aria-label="選擇時間篩選">
              <span>全部時間</span>
              <span class="select-caret">v</span>
            </button>
            <button class="filter-select" type="button" aria-label="選擇類型篩選">
              <span>全部類型</span>
              <span class="select-caret">v</span>
            </button>
          </div>
        </div>

        <ul class="history-list">
          <li v-for="item in historicalAlerts" :key="`${item.time}-${item.title}`">
            <button class="history-item" type="button">
              <div class="history-copy">
                <span class="history-type">{{ item.type }}</span>
                <strong>{{ item.title }}</strong>
                <small>{{ item.time }}</small>
              </div>
              <div class="history-side">
                <span class="level-chip">{{ item.level }}</span>
                <span class="detail-link">詳情</span>
              </div>
            </button>
          </li>
        </ul>
      </section>
    </section>
  </AppShell>
</template>

<style scoped>
.alerts-layout {
  display: grid;
  gap: 18px;
}

.current-alert,
.history-section {
  padding: 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(35, 63, 103, 0.1);
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
  color: #2c68ae;
  font-size: 0.9rem;
  font-weight: 700;
}

.section-label.warning {
  color: #db7b12;
}

.alert-banner strong,
.history-header strong,
.history-copy strong,
.alert-meta dd {
  color: #163250;
}

.alert-banner span,
.history-copy small,
.alert-meta dt {
  color: #6d8094;
}

.pending-tag,
.level-chip {
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(241, 127, 17, 0.12);
  color: #d4720f;
  font-size: 0.8rem;
  font-weight: 700;
}

.current-metrics {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.current-metrics article,
.history-item {
  border-radius: 20px;
  background: #f8fbff;
}

.current-metrics article {
  padding: 16px;
  display: grid;
  gap: 8px;
}

.current-metrics p,
.current-metrics span {
  margin: 0;
}

.current-metrics p {
  color: #35536f;
  font-size: 0.88rem;
  font-weight: 700;
}

.current-metrics strong {
  color: #df5a4e;
  font-size: 2rem;
  line-height: 1;
}

.current-metrics span {
  color: #70849a;
  font-size: 0.76rem;
}

.alert-meta {
  margin: 18px 0 0;
  display: grid;
  gap: 14px;
}

.alert-meta div {
  display: grid;
  gap: 4px;
}

.alert-meta dt,
.alert-meta dd {
  margin: 0;
}

.history-section {
  display: grid;
  gap: 18px;
}

.history-header {
  display: grid;
  gap: 14px;
}

.filter-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-select {
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #f3f7fc;
  color: #335274;
  font-size: 0.84rem;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(51, 82, 116, 0.08);
}

.select-caret {
  color: #6f8398;
  font-size: 0.78rem;
  line-height: 1;
}

.history-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.history-item {
  width: 100%;
  border: 0;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  text-align: left;
}

.history-copy {
  display: grid;
  gap: 4px;
}

.history-type {
  color: #d4720f;
  font-size: 0.78rem;
  font-weight: 700;
}

.history-side {
  display: grid;
  justify-items: end;
  gap: 10px;
}

.detail-link {
  color: #335f97;
  font-size: 0.82rem;
  font-weight: 700;
}
</style>
