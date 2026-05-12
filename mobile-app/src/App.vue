<script setup lang="ts">
import { onUnmounted, watch } from 'vue'

import { startDataGeneration, stopDataGeneration } from '@/modules/data-collector'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      startDataGeneration()
      return
    }

    stopDataGeneration()
  },
  { immediate: true },
)

onUnmounted(() => {
  stopDataGeneration()
})
</script>

<template>
  <RouterView />
</template>
