<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/stores/auth'

const settingItems = [
  { label: '個人資料', icon: 'user' },
  { label: '通知設定', icon: 'bell' },
  { label: '同步設定', icon: 'sync' },
  { label: '關於系統', icon: 'info' },
  { label: '登出', icon: 'logout' },
] as const

const router = useRouter()
const authStore = useAuthStore()

async function handleSettingAction(item: string) {
  if (item === '個人資料') {
    await router.push({ name: 'profile' })
    return
  }

  if (item === '登出') {
    await authStore.logout()
    await router.replace({ name: 'login' })
  }
}
</script>

<template>
  <AppShell title="設定">
    <section class="settings-card">
      <button
        v-for="item in settingItems"
        :key="item.label"
        class="settings-item"
        type="button"
        @click="handleSettingAction(item.label)"
      >
        <span class="item-copy">
          <span class="item-icon">
            <AppIcon :name="item.icon" :size="19" :stroke-width="2.1" />
          </span>
          <span>{{ item.label }}</span>
        </span>
        <span class="item-arrow"><AppIcon name="chevron-right" :size="16" :stroke-width="2.2" /></span>
      </button>
    </section>
  </AppShell>
</template>

<style scoped>
.settings-card {
  padding: 10px 0;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(35, 63, 103, 0.1);
}

.settings-item {
  width: 100%;
  border: 0;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  color: #163250;
  font-size: 1.1rem;
  font-weight: 700;
  text-align: left;
}

.item-copy {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.item-icon {
  color: #2e66b1;
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
}

.settings-item + .settings-item {
  border-top: 1px solid rgba(20, 48, 77, 0.08);
}

.item-arrow {
  color: #7890a8;
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
}
</style>
