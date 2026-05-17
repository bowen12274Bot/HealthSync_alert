<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ensureDefaultSimulationScenario, pauseSimulation } from '@/composables/useSimulationControl'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated) {
      ensureDefaultSimulationScenario()
      return
    }

    pauseSimulation()

    if (route.meta.requiresAuth) {
      await router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  pauseSimulation()
})
</script>

<template>
  <RouterView />
</template>
