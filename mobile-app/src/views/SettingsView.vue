<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/stores/auth'

const settingItems = [
  '個人資料',
  '通知設定',
  '同步設定',
  '關於系統',
  '登出',
]

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
        :key="item"
        class="settings-item"
        type="button"
        @click="handleSettingAction(item)"
      >
        <span>{{ item }}</span>
        <span class="item-arrow">></span>
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

.settings-item + .settings-item {
  border-top: 1px solid rgba(20, 48, 77, 0.08);
}

.item-arrow {
  color: #7890a8;
  font-size: 1rem;
}
</style>
