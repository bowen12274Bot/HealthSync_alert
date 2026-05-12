<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { startDataGeneration, stopDataGeneration } from '@/modules/data-collector'

onMounted(() => {
  startDataGeneration()
})

onUnmounted(() => {
  stopDataGeneration()
})
</script>

<template>
  <RouterView />
</template>
