<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <AppShell title="個人資料">
    <section class="profile-card">
      <p class="profile-label">Email</p>
      <strong>{{ authStore.currentUser?.email }}</strong>
      <p class="profile-note">使用者基本資訊之後會由伺服器資料庫提供。</p>
    </section>
  </AppShell>
</template>

<style scoped>
.profile-card {
  border-radius: 24px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(35, 63, 103, 0.1);
  display: grid;
  gap: 8px;
}

.profile-card p {
  margin: 0;
}

.profile-label {
  color: #2c68ae;
  font-size: 0.9rem;
  font-weight: 800;
}

.profile-card strong {
  color: #163250;
  font-size: 1.15rem;
}

.profile-note {
  color: #35536f;
  font-weight: 700;
}
</style>
