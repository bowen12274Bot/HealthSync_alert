<script setup lang="ts">
import { onUnmounted, watch } from 'vue'

import { ensureDefaultSimulationScenario, pauseSimulation } from '@/composables/useSimulationControl'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      ensureDefaultSimulationScenario()
      return
    }

    pauseSimulation()
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
