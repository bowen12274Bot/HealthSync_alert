<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'

const historicalAlerts = [
  { id: 'alert-20250514-1432', type: '即時預警', title: '發現異常指標', time: '2025/05/14 14:32', maxLevel: '中度', theme: 'moderate', icon: '!' },
  { id: 'alert-20250514-1018', type: '即時預警', title: '心率過高', time: '2025/05/14 10:18', maxLevel: '高度', theme: 'high', icon: '～' },
  { id: 'alert-20250513-2147', type: '即時預警', title: '血氧過低', time: '2025/05/13 21:47', maxLevel: '中度', theme: 'moderate', icon: '💧' },
  { id: 'alert-20250512-1803', type: '長期預警', title: 'HRV 過低', time: '2025/05/12 18:03', maxLevel: '輕度', theme: 'mild', icon: '～' },
  { id: 'alert-20250511-0922', type: '即時預警', title: '發現異常指標', time: '2025/05/11 09:22', maxLevel: '中度', theme: 'moderate', icon: '!' },
]
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
        <li v-for="item in historicalAlerts" :key="item.id">
          <RouterLink
            class="history-item"
            :class="`theme-${item.theme}`"
            :to="{ name: 'alert-display-history', params: { alertId: item.id } }"
          >
            <div class="history-icon">{{ item.icon }}</div>
            <div class="history-copy">
              <span class="history-type">{{ item.title }}</span>
              <small>{{ item.time }}</small>
            </div>
            <div class="history-side">
              <span class="level-chip">{{ item.maxLevel }}</span>
              <span class="detail-link">詳情</span>
            </div>
          </RouterLink>
        </li>
      </ul>

      <p class="history-end">已載入全部紀錄</p>
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
